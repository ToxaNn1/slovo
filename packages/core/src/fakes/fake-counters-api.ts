import type {
  CounterEvent,
  CounterEventsFailure,
  CountersApi,
  EntryCounters,
  RequestFailure,
} from '../ports';

/** A counters API for tests: the test sets the counts the backend keeps and makes requests fail. */
export interface FakeCountersApi extends CountersApi {
  /** The Entry ids of each `read` request, in order, failed ones included. */
  readonly asked: readonly (readonly string[])[];
  /** The events of each `send` request the backend counted, in order. */
  readonly sent: readonly (readonly CounterEvent[])[];
  /** How many `send` requests reached the API, the failed ones included. */
  readonly sends: number;
  /** Whether the backend can be reached; while it can't, every `send` answers `offline`. */
  online: boolean;
  /** Sets the counts the backend keeps for an Entry. */
  count(entryId: string, counts: Omit<EntryCounters, 'entryId'>): void;
  /** Fails the next `read` requests, one per reason, in order. */
  fail(...reasons: readonly RequestFailure['reason'][]): void;
  /**
   * Fails the next `send` request with the reason, before it counts anything;
   * too many requests says to retry after `retryAfter` seconds, if given.
   */
  failSend(reason: CounterEventsFailure['reason'], options?: { retryAfter?: number }): void;
}

/**
 * A counters API held in memory, for tests; it answers like the backend's
 * `counters.read` and keeps what `counters.send` counted.
 */
export function createFakeCountersApi(): FakeCountersApi {
  const counts = new Map<string, Omit<EntryCounters, 'entryId'>>();
  const failures: RequestFailure['reason'][] = [];
  const sendFailures: CounterEventsFailure[] = [];
  const asked: (readonly string[])[] = [];
  const sent: (readonly CounterEvent[])[] = [];
  let sends = 0;
  const api: FakeCountersApi = {
    asked,
    sent,
    get sends() {
      return sends;
    },
    online: true,
    count(entryId, entryCounts) {
      counts.set(entryId, entryCounts);
    },
    fail(...reasons) {
      failures.push(...reasons);
    },
    failSend(reason, { retryAfter } = {}) {
      sendFailures.push(
        reason === 'too-many-requests' ? { ok: false, reason, retryAfter } : { ok: false, reason },
      );
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
    send(events) {
      sends += 1;
      if (!api.online) return Promise.resolve({ ok: false, reason: 'offline' });
      const failure = sendFailures.shift();
      if (failure !== undefined) return Promise.resolve(failure);
      sent.push(events.map((event) => ({ ...event })));
      return Promise.resolve({ ok: true });
    },
  };
  return api;
}
