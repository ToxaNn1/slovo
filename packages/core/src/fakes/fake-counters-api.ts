import type { CountersApi, EntryCounters, RequestFailure } from '../ports';

/** A counters API for tests: the test sets the counts the backend keeps and makes requests fail. */
export interface FakeCountersApi extends CountersApi {
  /** The Entry ids of each `read` request, in order, failed ones included. */
  readonly asked: readonly (readonly string[])[];
  /** Sets the counts the backend keeps for an Entry. */
  count(entryId: string, counts: Omit<EntryCounters, 'entryId'>): void;
  /** Fails the next requests, one per reason, in order. */
  fail(...reasons: readonly RequestFailure['reason'][]): void;
}

/** A counters API held in memory, for tests; it answers like the backend's `counters.read`. */
export function createFakeCountersApi(): FakeCountersApi {
  const counts = new Map<string, Omit<EntryCounters, 'entryId'>>();
  const failures: RequestFailure['reason'][] = [];
  const asked: (readonly string[])[] = [];
  return {
    asked,
    count(entryId, entryCounts) {
      counts.set(entryId, entryCounts);
    },
    fail(...reasons) {
      failures.push(...reasons);
    },
    read(entryIds) {
      asked.push([...entryIds]);
      const reason = failures.shift();
      return Promise.resolve(
        reason === undefined
          ? {
              ok: true,
              counters: entryIds.map((entryId) => ({
                entryId,
                ...(counts.get(entryId) ?? { known: 0, unknown: 0, saved: 0 }),
              })),
            }
          : { ok: false, reason },
      );
    },
  };
}
