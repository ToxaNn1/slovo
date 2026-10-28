import { MistakeReportSchema, type MistakeReport } from '@slovo/contracts';

import type { ReportsApi, ReportsApiFailure } from '../ports';

/**
 * A Mistake Report API for tests that keeps the reports it takes in memory,
 * by the backend's rules (ADR 0056): it refuses a report of the wrong shape
 * (400) and answers 202 to any other.
 */
export interface FakeReportsApi extends ReportsApi {
  /** The reports the backend took, in order. */
  readonly received: readonly MistakeReport[];
  /** How many calls reached the API, the failed ones included. */
  readonly calls: number;
  /** Whether the backend can be reached; while it can't, every call answers `offline`. */
  online: boolean;
  /**
   * Makes the next call fail with the reason, before it keeps anything; too
   * many requests says to retry after `retryAfter` seconds, if given.
   */
  failNext(reason: ReportsApiFailure['reason'], options?: { retryAfter?: number }): void;
}

/** Makes a fake Mistake Report API, online. */
export function createFakeReportsApi(): FakeReportsApi {
  const received: MistakeReport[] = [];
  const failures: ReportsApiFailure[] = [];
  let calls = 0;

  const api: FakeReportsApi = {
    received,
    get calls() {
      return calls;
    },
    online: true,
    failNext(reason, { retryAfter } = {}) {
      failures.push(
        reason === 'too-many-requests' ? { ok: false, reason, retryAfter } : { ok: false, reason },
      );
    },
    send(report) {
      calls += 1;
      if (!api.online) return Promise.resolve({ ok: false, reason: 'offline' });
      const failure = failures.shift();
      if (failure !== undefined) return Promise.resolve(failure);
      const parsed = MistakeReportSchema.safeParse(report);
      if (!parsed.success) return Promise.resolve({ ok: false, reason: 'unexpected' });
      received.push(parsed.data);
      return Promise.resolve({ ok: true });
    },
  };
  return api;
}
