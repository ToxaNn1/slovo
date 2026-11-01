import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { answerOf } from '../backend';
import type { Edition } from '../edition/edition';
import type {
  Backend,
  Clock,
  PackFiles,
  PackVersion,
  Random,
  RequestFailure,
  Schedule,
} from '../ports';
import { withRetries } from '../retry';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** A content request that failed as any request does, or found no such Edition or pack (404). */
type ContentApiFailure = RequestFailure | { readonly ok: false; readonly reason: 'not-found' };

/** An Edition the backend doesn't serve, one with content updates off, or a pack not published. */
const notFound = ({ code }: { code: string }) =>
  code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined;

/** The file of a pack as the backend answers it. */
type PackFile = Extract<
  Awaited<ReturnType<Backend['content']['download']>>,
  { status: 200 }
>['body'];

/** How long after a check the next one is due: 24 hours. */
const CONTENT_UPDATE_EVERY = 24 * 60 * 60 * 1000;

/**
 * Content updates: the newer Language Packs of the Edition that the app
 * downloads by itself, without an Account, and opens from the next launch.
 */
export interface ContentUpdate {
  /**
   * Opens the kept pack at launch with the shell's `open`, when the app reads
   * its pack format and its content version is higher than the bundled
   * one's, so an App Store update with newer content never goes back to an
   * older download. Otherwise it forgets any kept pack and opens nothing:
   * the bundled pack is the one. A
   * kept pack that fails to open, such as one of another Edition, or whose
   * version fails to be read, is forgotten too, so the next due check
   * downloads one again, and it rejects with that failure.
   */
  openKept<R>(open: (version: PackVersion) => Promise<R>): Promise<R | undefined>;
  /**
   * Checks for a content update, when one is due: asks for the newest pack
   * of the highest pack format the app reads and downloads it when its
   * content version is higher than the newest the app has. A download whose
   * SHA-256 is right is kept for the next launch; any other is thrown away.
   * It never rejects: a check that fails, after the retries of
   * `withRetries`, keeps the pack the app has and waits for the next due
   * check, as a check that finds nothing does. A call while a check is under
   * way joins it.
   */
  checkForUpdate(): Promise<void>;
}

/**
 * Opens content updates over the pack bundled with the app and the pack
 * formats this app reads. The shell calls `openKept` once at launch, and
 * `checkForUpdate` at launch and on each return to the foreground; a check is
 * due at most once every `CONTENT_UPDATE_EVERY` by the clock, also across
 * launches. It throws when the app does not read the bundled pack's format.
 */
export function createContentUpdate({
  backend,
  edition,
  packFiles,
  readBytes = async (file) => new Uint8Array(await file.arrayBuffer()),
  userState,
  clock,
  random,
  schedule,
  bundled,
  readableFormats,
}: {
  backend: Pick<Backend, 'content'>;
  edition: Pick<Edition, 'id'>;
  packFiles: PackFiles;
  /** Reads the bytes of a downloaded file, as the platform can: React Native's `Blob` has no `arrayBuffer()`. */
  readBytes?: (file: PackFile) => Promise<Uint8Array>;
  userState: Pick<UserState, 'read' | 'write'>;
  clock: Clock;
  random: Random;
  schedule: Schedule;
  /** The version of the pack bundled with the app. */
  bundled: PackVersion;
  /** The pack formats this app reads; the bundled pack's is one of them. */
  readableFormats: readonly number[];
}): ContentUpdate {
  if (!readableFormats.includes(bundled.packFormat)) {
    throw new Error(
      `The app does not read the pack format ${String(bundled.packFormat)} of its bundled Language Pack`,
    );
  }
  const lastCheck = userStateRecords.contentUpdateCheckedAt;
  const retrying = { schedule, random };
  const editionId = edition.id;

  /** The newest published pack of the pack format; none when nothing of it is published. The content procedures need no Account. */
  async function latest(packFormat: number) {
    const answer = await answerOf(backend.content.latest({ editionId, packFormat }), notFound);
    return answer.ok ? ({ ok: true, pack: answer.output.pack ?? undefined } as const) : answer;
  }

  /** The bytes of the pack file of the content version. */
  async function download(
    contentVersion: number,
  ): Promise<{ readonly ok: true; readonly bytes: Uint8Array } | ContentApiFailure> {
    const answer = await answerOf(
      backend.content.download({ params: { editionId, contentVersion } }),
      notFound,
    );
    if (!answer.ok) return answer;
    // 304 answers only a download that names an ETag, which this one never does.
    if (answer.output.status !== 200) return { ok: false, reason: 'unexpected' };
    return { ok: true, bytes: await readBytes(answer.output.body) };
  }

  /** The kept pack, when the app reads its format and it is newer than the bundled one. */
  async function newerKept(): Promise<PackVersion | undefined> {
    const kept = await packFiles.read();
    const newer =
      kept !== undefined &&
      readableFormats.includes(kept.packFormat) &&
      kept.contentVersion > bundled.contentVersion;
    return newer ? kept : undefined;
  }

  async function openKept<R>(open: (version: PackVersion) => Promise<R>): Promise<R | undefined> {
    try {
      const kept = await newerKept();
      if (kept !== undefined) return await open(kept);
    } catch (error) {
      // A pack that fails to be forgotten fails again at the next launch, which forgets it then.
      await packFiles.forget().catch(() => undefined);
      throw error;
    }
    await packFiles.forget();
    return undefined;
  }

  async function due(): Promise<boolean> {
    const last = await userState.read(lastCheck);
    if (last === undefined) return true;
    const since = clock.now().getTime() - new Date(last).getTime();
    // A clock put back before the last check makes it due too.
    return since < 0 || since >= CONTENT_UPDATE_EVERY;
  }

  /** Downloads a pack newer than the newest the app has, if one is published, and keeps it. */
  async function check(): Promise<void> {
    const newest = await withRetries(() => latest(Math.max(...readableFormats)), retrying);
    if (!newest.ok || newest.pack === undefined) return;
    const { contentVersion, packFormat, fileSha256 } = newest.pack;
    const has = (await newerKept()) ?? bundled;
    if (contentVersion <= has.contentVersion) return;
    const downloaded = await withRetries(() => download(contentVersion), retrying);
    // A damaged or tampered download is thrown away.
    if (!downloaded.ok || bytesToHex(sha256(downloaded.bytes)) !== fileSha256) return;
    await packFiles.keep({ contentVersion, packFormat }, downloaded.bytes);
  }

  async function checkIfDue(): Promise<void> {
    try {
      if (!(await due())) return;
      // Written first, so a check that fails or is cut short waits for the next due one too.
      await userState.write(lastCheck.change(clock.now().toISOString()));
      await check();
    } catch {
      // Silent: the app keeps the pack it has.
    }
  }

  let underWay: Promise<void> | undefined;

  function checkForUpdate(): Promise<void> {
    underWay ??= checkIfDue().finally(() => {
      underWay = undefined;
    });
    return underWay;
  }

  return { openKept, checkForUpdate };
}
