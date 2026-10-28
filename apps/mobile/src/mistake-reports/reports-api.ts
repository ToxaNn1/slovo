import type { ApiClient } from '@slovo/contracts/api';
import type { ReportsApi } from '@slovo/core';

import { answerOf, secondsOf, type ClientFetch } from '../api';

/**
 * The Core's `ReportsApi` on the API contract's client. It sends no Session,
 * even when the reader is signed in (ADR 0056). A call builds its client with
 * a `fetch` that reads the `Retry-After` of a 429 answer, which the client
 * doesn't hand on with its error (ADR 0037).
 */
export function createReportsApi({
  clientOf,
  fetch = (request) => globalThis.fetch(request),
}: {
  /** The client of a device that sends no Session, sending its requests with `fetch`. */
  clientOf: (fetch: ClientFetch) => Pick<ApiClient, 'reports'>;
  /** What reaches the backend: the global `fetch` unless a test serves the contract in process. */
  fetch?: ClientFetch;
}): ReportsApi {
  return {
    async send(report) {
      let retryAfter: number | undefined;
      const { reports } = clientOf(async (...request) => {
        const response = await fetch(...request);
        if (response.status === 429) retryAfter = secondsOf(response.headers.get('retry-after'));
        return response;
      });
      const answer = await answerOf(reports.send(report), ({ code }) =>
        code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined,
      );
      if (answer.ok) return { ok: true };
      const { reason } = answer;
      return reason === 'too-many-requests'
        ? { ok: false, reason, retryAfter }
        : { ok: false, reason };
    },
  };
}
