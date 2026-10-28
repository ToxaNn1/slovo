import { createApiClient } from '@slovo/contracts/api';
import { serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { createCommunityWordApi } from './community-word-api';

/** The Community Word API of the Ukrainian Edition over whatever `fetch` reaches. */
const communityWordApiOver = (fetch: (request: Request) => Promise<Response>) =>
  createCommunityWordApi({
    client: createApiClient({ url: 'http://backend.test', fetch }),
    editionId: 'uk',
  });

/** The Community Word API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const communityWordApiServedBy = (procedures: ApiProcedures) =>
  communityWordApiOver(serveApi(procedures));

describe('the Community Word API over the contract’s client', () => {
  it('asks for the Edition’s Community Word with no Session, and answers it with its adds', async () => {
    const asked: unknown[] = [];
    const api = communityWordApiServedBy({
      counters: {
        communityWord: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return { communityWord: { entryId: 'w_abc123', adds: 12 } };
        },
      },
    });

    await expect(api.communityWord()).resolves.toEqual({
      ok: true,
      communityWord: { entryId: 'w_abc123', adds: 12 },
    });
    expect(asked).toEqual([{ input: { edition: 'uk' }, session: null }]);
  });

  it('answers none when nobody added anything last week', async () => {
    const api = communityWordApiServedBy({
      counters: { communityWord: () => ({ communityWord: null }) },
    });

    await expect(api.communityWord()).resolves.toEqual({ ok: true, communityWord: undefined });
  });

  it('answers a server error when the backend fails', async () => {
    const api = communityWordApiServedBy({});

    await expect(api.communityWord()).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it('answers offline when no answer comes', async () => {
    const api = communityWordApiOver(() => Promise.reject(new TypeError('Network request failed')));

    await expect(api.communityWord()).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});
