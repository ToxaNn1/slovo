import { describe, expect, it } from 'vitest';

import { createApiClient } from '../api';
import { describeApi } from '../api-description';
import type { CollectionLink } from '../collection-link';
import { serveApi } from './test-support';

/** A Collection as the app shares it. */
const SHARED: CollectionLink = {
  edition: 'uk',
  name: 'Осінь',
  entryIds: ['w_listopad', 'i_babynelito', 'c_odyahaty'],
};

/** A link's id as the backend makes it: 10 letters and digits. */
const ID = 'aZ3kQ9mB0x';

/** A backend that keeps each Collection it is asked to share, under `ID`. */
function backend() {
  const received: unknown[] = [];
  const serve = serveApi({
    collectionLinks: {
      create: ({ input }) => {
        received.push(input);
        return { id: ID, url: `https://slovo.example/c/${ID}` };
      },
      read: ({ input, errors }) => {
        if (input.id !== ID) throw errors.NOT_FOUND();
        return SHARED;
      },
    },
  });
  /** Sends `body` as JSON to `POST /v1/collection-links`, as any client may. */
  const post = (body: object) =>
    serve(
      new Request('http://backend.test/v1/collection-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  /** Asks `GET /v1/collection-links/{id}`, as any client may. */
  const get = (id: string) => serve(new Request(`http://backend.test/v1/collection-links/${id}`));
  const api = createApiClient({ url: 'http://backend.test', fetch: serve });
  return { api, post, get, received };
}

describe('POST /v1/collection-links', () => {
  it("answers the link's id and URL", async () => {
    const { api, received } = backend();

    const link = await api.collectionLinks.create(SHARED);

    expect(link).toEqual({ id: ID, url: `https://slovo.example/c/${ID}` });
    expect(received).toEqual([SHARED]);
  });

  it('passes the backend the name trimmed', async () => {
    const { api, received } = backend();

    await api.collectionLinks.create({ ...SHARED, name: '  Осінь\n' });

    expect(received).toEqual([SHARED]);
  });

  it('takes a name of 60 characters and 200 Entries of each kind', async () => {
    const { api, received } = backend();
    const name = 'а'.repeat(60);
    const kinds = ['w', 'c', 'i', 'r', 't'];
    const entryIds = Array.from({ length: 200 }, (_, n) => `${kinds[n % 5] ?? 'w'}_a${String(n)}`);

    await api.collectionLinks.create({ ...SHARED, name, entryIds });

    expect(received).toEqual([{ ...SHARED, name, entryIds }]);
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a name of spaces only', { name: '   ' }],
    ['a name of 61 characters', { name: 'а'.repeat(61) }],
    ['no Entries', { entryIds: [] }],
    ['201 Entries', { entryIds: Array.from({ length: 201 }, (_, n) => `w_a${String(n)}`) }],
    ['an Entry twice', { entryIds: ['w_listopad', 'w_listopad'] }],
    ['an id that names no Entry', { entryIds: ['x_a1'] }],
    ['an Edition id that is no id', { edition: 'UK' }],
    ['an Account', { accountId: 'a_1' }],
    ['a device id', { deviceId: 'd_1' }],
  ])('refuses %s with 400 BAD_REQUEST', async (_case, change) => {
    const { post, received } = backend();

    const response = await post({ ...SHARED, ...change });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
    expect(received).toEqual([]);
  });

  it.each(['edition', 'name', 'entryIds'])('refuses a body with no %s', async (field) => {
    const { post } = backend();

    const response = await post(
      Object.fromEntries(Object.entries(SHARED).filter(([key]) => key !== field)),
    );

    expect(response.status).toBe(400);
  });

  it('answers 429 TOO_MANY_REQUESTS over the limit', async () => {
    const serve = serveApi({
      collectionLinks: {
        create: ({ errors }) => {
          throw errors.TOO_MANY_REQUESTS();
        },
      },
    });
    const api = createApiClient({ url: 'http://backend.test', fetch: serve });

    await expect(api.collectionLinks.create(SHARED)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      status: 429,
    });
  });
});

describe('GET /v1/collection-links/{id}', () => {
  it('answers the Collection as it was shared', async () => {
    const { api } = backend();

    expect(await api.collectionLinks.read({ id: ID })).toEqual(SHARED);
  });

  it('answers 404 NOT_FOUND for an id it does not know', async () => {
    const { get } = backend();

    const response = await get('bZ3kQ9mB0x');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    ['of 9 characters', 'aZ3kQ9mB0'],
    ['of 11 characters', 'aZ3kQ9mB0xy'],
    ['with a sign that is no letter or digit', 'aZ3kQ9mB0-'],
  ])('refuses an id %s with 400 BAD_REQUEST', async (_case, id) => {
    const { get } = backend();

    const response = await get(id);

    expect(response.status).toBe(400);
  });
});

describe('the OpenAPI description', () => {
  it('lists both Collection Link operations with their answers', async () => {
    const { paths } = (await describeApi()) as {
      paths: Partial<
        Record<string, Partial<Record<'get' | 'post', { responses: Record<string, unknown> }>>>
      >;
    };

    expect(Object.keys(paths['/v1/collection-links']?.post?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '404', '429']),
    );
    expect(Object.keys(paths['/v1/collection-links/{id}']?.get?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '404']),
    );
  });
});
