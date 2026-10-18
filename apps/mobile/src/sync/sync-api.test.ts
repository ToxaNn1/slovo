import { createApiClient } from '@slovo/contracts/api';
import { failingWith, serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import type { RecordChange, SyncApi } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { createSyncApi } from './sync-api';

/** The Sync API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const syncApiServedBy = (procedures: ApiProcedures) => syncApiOver(serveApi(procedures));

/** The Sync API of the Ukrainian Edition over whatever `fetch` reaches. */
const syncApiOver = (fetch: (request: Request) => Promise<Response>) =>
  createSyncApi({
    clientOf: (token, clientFetch) =>
      createApiClient({
        url: 'http://backend.test',
        headers: { authorization: `Bearer ${token}` },
        fetch: clientFetch,
      }),
    fetch,
    editionId: 'uk',
  });

const changes: RecordChange[] = [
  { key: 'favorites.a', value: { word: 'a' }, changedAt: 1_000 },
  { key: 'favorites.b', value: null, changedAt: 2_000 },
];

/** Every call of the Sync API, each calling the procedure of its name. */
const calls: Record<keyof SyncApi, (api: SyncApi) => Promise<unknown>> = {
  push: (api) => api.push('the-token', changes),
  pull: (api) => api.pull('the-token', 7),
};

const everyCall = Object.keys(calls) as (keyof SyncApi)[];

/** A backend whose pushes and pulls refuse with `code`, setting `Retry-After` when given. */
const refusing = (
  code: 'TOO_MANY_REQUESTS' | 'UNAUTHORIZED' | 'NOT_FOUND',
  retryAfter?: string,
): ApiProcedures => {
  const refuse = (resHeaders: Headers | undefined, error: () => Error): never => {
    if (retryAfter !== undefined) resHeaders?.set('retry-after', retryAfter);
    throw error();
  };
  return {
    sync: {
      push: ({ errors, context }) => refuse(context.resHeaders, errors[code]),
      pull: ({ errors, context }) => refuse(context.resHeaders, errors[code]),
    },
  };
};

describe('the Sync API over the contract’s client', () => {
  it('pushes the changes, tombstones included, to the Edition with the Session as a bearer token', async () => {
    const asked: unknown[] = [];
    const syncApi = syncApiServedBy({
      sync: {
        push: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return {};
        },
      },
    });

    await expect(syncApi.push('the-token', changes)).resolves.toEqual({ ok: true });
    expect(asked).toEqual([{ input: { editionId: 'uk', changes }, session: 'Bearer the-token' }]);
  });

  it('pulls the page after the cursor and answers its records, cursor and whether more follow', async () => {
    const asked: unknown[] = [];
    const syncApi = syncApiServedBy({
      sync: {
        pull: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return { records: changes, cursor: 12, more: true };
        },
      },
    });

    await expect(syncApi.pull('the-token', 7)).resolves.toEqual({
      ok: true,
      records: changes,
      cursor: 12,
      more: true,
    });
    expect(asked).toEqual([{ input: { editionId: 'uk', after: 7 }, session: 'Bearer the-token' }]);
  });

  it('pulls from the first record when it has no cursor', async () => {
    const asked: unknown[] = [];
    const syncApi = syncApiServedBy({
      sync: {
        pull: ({ input }) => {
          asked.push(input);
          return { records: [], cursor: 0, more: false };
        },
      },
    });

    await expect(syncApi.pull('the-token', undefined)).resolves.toEqual({
      ok: true,
      records: [],
      cursor: 0,
      more: false,
    });
    expect(asked).toEqual([{ editionId: 'uk' }]);
  });

  it.each(everyCall)('%s answers unauthorized when the Session has ended', async (call) => {
    const syncApi = syncApiServedBy(failingWith('UNAUTHORIZED'));

    await expect(calls[call](syncApi)).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it.each(everyCall)('%s answers not found when the Edition has Sync off', async (call) => {
    const syncApi = syncApiServedBy(failingWith('NOT_FOUND'));

    await expect(calls[call](syncApi)).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('answers too many records when a push would take the Account over its limit', async () => {
    const syncApi = syncApiServedBy({
      sync: {
        push: ({ errors }) => {
          throw errors.TOO_MANY_RECORDS();
        },
      },
    });

    await expect(syncApi.push('the-token', changes)).resolves.toEqual({
      ok: false,
      reason: 'too-many-records',
    });
  });

  it.each(everyCall)('%s answers too many requests with the answer’s Retry-After', async (call) => {
    const syncApi = syncApiServedBy(refusing('TOO_MANY_REQUESTS', '360'));

    await expect(calls[call](syncApi)).resolves.toEqual({
      ok: false,
      reason: 'too-many-requests',
      retryAfter: 360,
    });
  });

  it.each(everyCall)(
    '%s answers too many requests with no Retry-After when it has none',
    async (call) => {
      const syncApi = syncApiServedBy(refusing('TOO_MANY_REQUESTS'));

      await expect(calls[call](syncApi)).resolves.toEqual({
        ok: false,
        reason: 'too-many-requests',
        retryAfter: undefined,
      });
    },
  );

  it.each(['soon', '-5', ''])('reads the Retry-After %j as none', async (retryAfter) => {
    const syncApi = syncApiServedBy(refusing('TOO_MANY_REQUESTS', retryAfter));

    await expect(syncApi.pull('the-token', undefined)).resolves.toEqual({
      ok: false,
      reason: 'too-many-requests',
      retryAfter: undefined,
    });
  });

  it('keeps one call’s Retry-After from the next', async () => {
    let refuse = true;
    const syncApi = syncApiServedBy({
      sync: {
        pull: ({ errors, context }) => {
          if (!refuse) throw errors.TOO_MANY_REQUESTS();
          refuse = false;
          context.resHeaders?.set('retry-after', '60');
          throw errors.TOO_MANY_REQUESTS();
        },
      },
    });

    await syncApi.pull('the-token', undefined);
    await expect(syncApi.pull('the-token', undefined)).resolves.toEqual({
      ok: false,
      reason: 'too-many-requests',
      retryAfter: undefined,
    });
  });

  it.each(everyCall)('%s answers a server error when the backend fails', async (call) => {
    const syncApi = syncApiServedBy({});

    await expect(calls[call](syncApi)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it.each(everyCall)('%s answers a server error when a proxy answers 502', async (call) => {
    const syncApi = syncApiOver(() =>
      Promise.resolve(new Response('<h1>502 Bad Gateway</h1>', { status: 502 })),
    );

    await expect(calls[call](syncApi)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it.each(everyCall)('%s answers offline when no answer comes', async (call) => {
    const syncApi = syncApiOver(() => Promise.reject(new TypeError('Network request failed')));

    await expect(calls[call](syncApi)).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it.each(everyCall)('%s answers unexpected when the backend refuses the request', async (call) => {
    const syncApi = syncApiServedBy(failingWith('BAD_REQUEST'));

    await expect(calls[call](syncApi)).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });
});
