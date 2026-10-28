import type { ApiClient } from '@slovo/contracts/api';
import type { RequestFailure, SyncApi, SyncApiFailure } from '@slovo/core';

import { answerOf, secondsOf, type ClientFetch } from '../api';

/** A failure of a call as the contract's errors and the request itself make it, before a 429 gets its `Retry-After`. */
type CallFailure = RequestFailure | Exclude<SyncApiFailure, { reason: 'too-many-requests' }>;

function withRetryAfter(failure: CallFailure, retryAfter: number | undefined): SyncApiFailure {
  return failure.reason === 'too-many-requests'
    ? { ok: false, reason: failure.reason, retryAfter }
    : { ok: false, reason: failure.reason };
}

/**
 * The Core's `SyncApi` for the running Edition, on the API contract's client
 * of the Session whose token each call carries. A call builds its client with
 * a `fetch` that reads the `Retry-After` of a 429 answer, which the client
 * doesn't hand on with its error (ADR 0037).
 */
export function createSyncApi({
  clientOf,
  fetch = (request) => globalThis.fetch(request),
  editionId,
}: {
  /** The client of a device signed in with the Session's token, sending its requests with `fetch`. */
  clientOf: (token: string, fetch: ClientFetch) => Pick<ApiClient, 'sync'>;
  /** What reaches the backend: the global `fetch` unless a test serves the contract in process. */
  fetch?: ClientFetch;
  editionId: string;
}): SyncApi {
  /** A client of its own, which keeps the `Retry-After` of a 429 answer for `retryAfter()`. */
  function clientWithRetryAfter(token: string) {
    let retryAfter: number | undefined;
    const client = clientOf(token, async (...request) => {
      const response = await fetch(...request);
      if (response.status === 429) retryAfter = secondsOf(response.headers.get('retry-after'));
      return response;
    });
    return { sync: client.sync, retryAfter: () => retryAfter };
  }

  return {
    async push(token, changes) {
      const { sync, retryAfter } = clientWithRetryAfter(token);
      const answer = await answerOf(sync.push({ editionId, changes: [...changes] }), ({ code }) => {
        if (code === 'UNAUTHORIZED') return { ok: false, reason: 'unauthorized' } as const;
        if (code === 'NOT_FOUND') return { ok: false, reason: 'not-found' } as const;
        if (code === 'TOO_MANY_RECORDS') return { ok: false, reason: 'too-many-records' } as const;
        return undefined;
      });
      if (answer.ok) return { ok: true };
      return withRetryAfter(answer, retryAfter());
    },
    async pull(token, after) {
      const { sync, retryAfter } = clientWithRetryAfter(token);
      const answer = await answerOf(
        sync.pull(after === undefined ? { editionId } : { editionId, after }),
        ({ code }) => {
          if (code === 'UNAUTHORIZED') return { ok: false, reason: 'unauthorized' } as const;
          if (code === 'NOT_FOUND') return { ok: false, reason: 'not-found' } as const;
          return undefined;
        },
      );
      if (answer.ok) return { ok: true, ...answer.output };
      return withRetryAfter(answer, retryAfter());
    },
  };
}
