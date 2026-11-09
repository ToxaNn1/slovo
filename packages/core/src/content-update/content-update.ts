import { answerOf } from '../backend';
import type { Edition } from '../edition/edition';
import type { Backend, ContentStore, Random, Schedule } from '../ports';
import { withRetries } from '../retry';

/** An Edition the backend doesn't serve, one with content updates off, or one not imported yet. */
const notFound = ({ code }: { code: string }) =>
  code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined;

/** How often a check runs while the app is in the foreground: every 15 minutes. */
export const CONTENT_UPDATE_EVERY = 15 * 60 * 1000;

/**
 * Content updates: the Patches of the Edition that the app fetches by
 * itself, without an Account, and applies at once to its Language Pack
 * (ADR 0090).
 */
export interface ContentUpdate {
  /**
   * Checks for a Patch: asks for the records changed after the pack's content
   * version, in the highest Patch format the app reads, and applies the Patch
   * through the content store, then tells the subscribers. A 304, a Patch
   * format the backend does not serve, a check that fails after the retries
   * of `withRetries`, or a Patch the store rejects changes nothing. It never
   * rejects. A call while a check is under way joins it.
   */
  checkForUpdate(): Promise<void>;
  /**
   * Checks every `CONTENT_UPDATE_EVERY` by the schedule, until the returned
   * function stops it, as the shell does when the app leaves the foreground.
   */
  followForeground(): () => void;
  /** The content version the pack holds now. */
  contentVersion(): number;
  /** Calls the listener after each Patch applied, until the returned function unsubscribes it. */
  subscribe(listener: () => void): () => void;
}

/**
 * Opens content updates over the device's content store and the Patch
 * formats this app reads. The shell calls `checkForUpdate` at launch and on
 * each return to the foreground, and `followForeground` while the app is in
 * the foreground.
 */
export function createContentUpdate({
  backend,
  edition,
  store,
  random,
  schedule,
  readableFormats,
}: {
  backend: Pick<Backend, 'content'>;
  edition: Pick<Edition, 'id'>;
  store: ContentStore;
  random: Random;
  schedule: Schedule;
  /** The Patch formats this app reads. */
  readableFormats: readonly number[];
}): ContentUpdate {
  const retrying = { schedule, random };
  const editionId = edition.id;
  const listeners = new Set<() => void>();

  /** The Patch since the pack's content version, if the backend has one the app reads. The content procedures need no Account. */
  async function check(): Promise<void> {
    const etag = store.etag();
    const answer = await withRetries(
      () =>
        answerOf(
          backend.content.patch({
            params: { editionId },
            query: { since: store.contentVersion(), patchFormat: Math.max(...readableFormats) },
            ...(etag === undefined ? {} : { headers: { 'if-none-match': etag } }),
          }),
          notFound,
        ),
      retrying,
    );
    if (!answer.ok || answer.output.status !== 200) return;
    const { body, headers } = answer.output;
    if (body.status !== 'patch') return;
    await store.apply(body.patch, headers.etag);
    for (const listener of listeners) listener();
  }

  let underWay: Promise<void> | undefined;

  function checkForUpdate(): Promise<void> {
    underWay ??= check()
      .catch(() => {
        // Silent: the app keeps the content it has.
      })
      .finally(() => {
        underWay = undefined;
      });
    return underWay;
  }

  function followForeground(): () => void {
    let cancel = schedule(function tick() {
      void checkForUpdate();
      cancel = schedule(tick, CONTENT_UPDATE_EVERY);
    }, CONTENT_UPDATE_EVERY);
    return () => {
      cancel();
    };
  }

  return {
    checkForUpdate,
    followForeground,
    contentVersion: () => store.contentVersion(),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
