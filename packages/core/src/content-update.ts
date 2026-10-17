import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import type { Clock, ContentApi, PackFiles, PackVersion, Random, Schedule } from './ports';
import { withRetries } from './retry';
import type { UserState } from './user-state/user-state';
import { userStateRecords } from './user-state/user-state-schema';

/** How long after a finished check the next one is due: 24 hours. */
export const CONTENT_UPDATE_EVERY = 24 * 60 * 60 * 1000;

/**
 * Content updates: the newer Language Packs of the Edition that the app
 * downloads by itself, without an Account, and opens from the next launch.
 */
export interface ContentUpdate {
  /**
   * Which pack the shell opens at launch, before the Language Pack opens: the
   * kept one when the app reads its pack format and its content version is
   * higher than the bundled one's, so an App Store update with newer content
   * never goes back to an older download. Any other kept pack is forgotten.
   */
  choosePack(): Promise<'bundled' | 'kept'>;
  /**
   * Checks for a content update, when one is due: asks for the newest pack
   * of the highest pack format the app reads and downloads it when its
   * content version is higher than the newest the app has. A download whose
   * SHA-256 is right is kept for the next launch; any other is thrown away.
   * It never rejects: a failure, after the retries of `withRetries`, leaves
   * the check due, so the next call checks again. A call while a check is
   * under way joins it.
   */
  checkForUpdate(): Promise<void>;
}

/**
 * Opens content updates over the pack bundled with the app and the pack
 * formats this app reads. The shell calls `choosePack` once at launch, and
 * `checkForUpdate` at launch and on each return to the foreground; a check is
 * due at most once every `CONTENT_UPDATE_EVERY` by the clock, also across
 * launches.
 */
export function createContentUpdate({
  contentApi,
  packFiles,
  userState,
  clock,
  random,
  schedule,
  bundled,
  readableFormats,
}: {
  contentApi: ContentApi;
  packFiles: PackFiles;
  userState: Pick<UserState, 'read' | 'write'>;
  clock: Clock;
  random: Random;
  schedule: Schedule;
  /** The version of the pack bundled with the app. */
  bundled: PackVersion;
  /** The pack formats this app reads; the bundled pack's is one of them. */
  readableFormats: readonly number[];
}): ContentUpdate {
  const checkedAt = userStateRecords.contentUpdateCheckedAt;
  const retrying = { schedule, random };

  /** The kept pack, when the app reads its format and it is newer than the bundled one. */
  async function newerKept(): Promise<PackVersion | undefined> {
    const kept = await packFiles.read();
    const newer =
      kept !== undefined &&
      readableFormats.includes(kept.packFormat) &&
      kept.contentVersion > bundled.contentVersion;
    return newer ? kept : undefined;
  }

  async function choosePack(): Promise<'bundled' | 'kept'> {
    if ((await newerKept()) !== undefined) return 'kept';
    await packFiles.forget();
    return 'bundled';
  }

  async function due(): Promise<boolean> {
    const last = await userState.read(checkedAt);
    if (last === undefined) return true;
    const since = clock.now().getTime() - new Date(last).getTime();
    // A clock put back before the last check makes it due too.
    return since < 0 || since >= CONTENT_UPDATE_EVERY;
  }

  /** Checks, and tells whether the check finished; a failure leaves it unfinished. */
  async function check(): Promise<boolean> {
    const latest = await withRetries(
      () => contentApi.latest(Math.max(...readableFormats)),
      retrying,
    );
    if (!latest.ok) return false;
    const { pack } = latest;
    const newest = (await newerKept()) ?? bundled;
    if (pack === undefined || pack.contentVersion <= newest.contentVersion) return true;
    const download = await withRetries(() => contentApi.download(pack.contentVersion), retrying);
    if (!download.ok) return false;
    // A damaged or tampered download is thrown away: the same bytes would come again.
    if (bytesToHex(sha256(download.bytes)) !== pack.fileSha256) return true;
    const { contentVersion, packFormat } = pack;
    await packFiles.keep({ contentVersion, packFormat }, download.bytes);
    return true;
  }

  async function checkIfDue(): Promise<void> {
    try {
      if (!(await due()) || !(await check())) return;
      await userState.write(checkedAt.change(clock.now().toISOString()));
    } catch {
      // Silent: the app keeps the pack it has, and the check stays due.
    }
  }

  let underWay: Promise<void> | undefined;

  function checkForUpdate(): Promise<void> {
    underWay ??= checkIfDue().finally(() => {
      underWay = undefined;
    });
    return underWay;
  }

  return { choosePack, checkForUpdate };
}
