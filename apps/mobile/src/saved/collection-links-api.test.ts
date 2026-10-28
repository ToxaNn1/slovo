import { createApiClient } from '@slovo/contracts/api';
import { serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { createCollectionLinksApi } from './collection-links-api';

/** The Collection Link API over a backend that serves the contract's `procedures`. */
const collectionLinksApiServedBy = (procedures: ApiProcedures) =>
  createCollectionLinksApi({
    client: createApiClient({ url: 'http://backend.test', fetch: serveApi(procedures) }),
  });

const autumn = { edition: 'uk', name: 'Осінь', entryIds: ['w_kvasha', 'w_buzok'] };

describe('the Collection Link API over the contract’s client', () => {
  it('stores the Collection with no Session, and answers the link’s id and URL', async () => {
    const asked: unknown[] = [];
    const api = collectionLinksApiServedBy({
      collectionLinks: {
        create: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return { id: 'abc123defg', url: 'https://slovo.example/c/abc123defg' };
        },
      },
    });

    await expect(api.create(autumn)).resolves.toEqual({
      ok: true,
      id: 'abc123defg',
      url: 'https://slovo.example/c/abc123defg',
    });
    expect(asked).toEqual([{ input: autumn, session: null }]);
  });

  it('answers too many requests over the day’s limit', async () => {
    const api = collectionLinksApiServedBy({
      collectionLinks: {
        create: ({ errors }) => {
          throw errors.TOO_MANY_REQUESTS();
        },
      },
    });

    await expect(api.create(autumn)).resolves.toEqual({ ok: false, reason: 'too-many-requests' });
  });

  it('reads a link back as it was stored', async () => {
    const api = collectionLinksApiServedBy({
      collectionLinks: { read: () => autumn },
    });

    await expect(api.read('abc123defg')).resolves.toEqual({ ok: true, link: autumn });
  });

  it('answers not found for an unknown link or an Edition with Collection Links off', async () => {
    const api = collectionLinksApiServedBy({
      collectionLinks: {
        create: ({ errors }) => {
          throw errors.NOT_FOUND();
        },
        read: ({ errors }) => {
          throw errors.NOT_FOUND();
        },
      },
    });

    await expect(api.create(autumn)).resolves.toEqual({ ok: false, reason: 'not-found' });
    await expect(api.read('abc123defg')).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('answers a server error when the backend fails', async () => {
    const api = collectionLinksApiServedBy({});

    await expect(api.create(autumn)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });
});
