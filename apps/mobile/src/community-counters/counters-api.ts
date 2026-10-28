import type { ApiClient } from '@slovo/contracts/api';
import type { CountersApi } from '@slovo/core';

import { answerOf, secondsOf, type ClientFetch } from '../api';

/**
 * The Core's `CountersApi` on the API contract's client for the running
 * Edition. It sends no Session, even when the reader is signed in, and no
 * device id (ADR 0060). A call builds its client with a `fetch` that reads the
 * `Retry-After` of a 429 answer, which the client doesn't hand on with its
 * error (ADR 0037).
 */
export function createCountersApi({
  clientOf,
  fetch = (request) => globalThis.fetch(request),
  editionId,
}: {
  /** The client of a device that sends no Session, sending its requests with `fetch`. */
  clientOf: (fetch: ClientFetch) => Pick<ApiClient, 'counters'>;
  /** What reaches the backend: the global `fetch` unless a test serves the contract in process. */
  fetch?: ClientFetch;
  editionId: string;
}): CountersApi {
  return {
    async read(entryIds) {
      const { counters } = clientOf(fetch);
      const answer = await answerOf(
        counters.read({ edition: editionId, entries: entryIds.join(',') }),
      );
      return answer.ok ? { ok: true, counters: answer.output.counters } : answer;
    },
    async send(events) {
      let retryAfter: number | undefined;
      const { counters } = clientOf(async (...request) => {
        const response = await fetch(...request);
        if (response.status === 429) retryAfter = secondsOf(response.headers.get('retry-after'));
        return response;
      });
      const answer = await answerOf(
        counters.send({ editionId, events: [...events] }),
        ({ code }) =>
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
