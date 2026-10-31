import { randomInt } from 'node:crypto';

import type { CollectionLink } from '@slovo/contracts';
import type { Random } from '@slovo/server-core';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { Database } from '../database/database';
import { collectionLinks, rateLimits } from '../database/schema';
import { newIp, passTime, testApp, testEditions } from '../test-support';

const DAY = 24 * 60 * 60 * 1000;

const ID_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A Collection Link id no other test draws, since the tests of the file share its database. */
const newLinkId = () =>
  Array.from({ length: 10 }, () => ID_CHARACTERS.charAt(randomInt(ID_CHARACTERS.length))).join('');

/**
 * A random source that draws the characters of the ids in turn, as the
 * backend draws a link's id, and nothing after them.
 */
function drawing(...ids: string[]): Random {
  const draws = ids.flatMap((id) =>
    Array.from(id, (character) => ID_CHARACTERS.indexOf(character)),
  );
  return {
    int(bound) {
      const draw = draws.shift();
      if (draw === undefined) throw new Error('the test drew more than it gave');
      expect(bound).toBe(ID_CHARACTERS.length);
      return draw;
    },
  };
}

/** A valid Collection of the UA Edition, as «Поділитися посиланням» sends it. */
const validLink = (change: Partial<CollectionLink> = {}): CollectionLink => ({
  edition: 'uk',
  name: 'Осінь',
  entryIds: ['w_b2', 'c_a1', 'w_a1'],
  ...change,
});

/** A body as JSON, for a test that sends its own request. */
const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

/** A Collection name no other test shares, so a test counts only its own links. */
const newName = () => `Осінь ${String(randomInt(1_000_000_000))}`;

/** The links the database keeps of the Edition under the name. */
const keptNamed = async ({ db }: Database, name: string, edition = 'uk') =>
  db
    .select()
    .from(collectionLinks)
    .where(and(eq(collectionLinks.name, name), eq(collectionLinks.editionId, edition)));

/** The row the database keeps of the link, if any. */
const keptOf = async ({ db }: Database, id: string) => {
  const [row] = await db.select().from(collectionLinks).where(eq(collectionLinks.id, id));
  return row;
};

describe('collectionLinks.create', () => {
  it('keeps the Collection under the id it draws and answers the link on the Edition’s domain', async () => {
    const id = newLinkId();
    const { client, database } = testApp({ random: drawing(id) });
    const made = new Date();

    await expect(client.collectionLinks.create(validLink())).resolves.toEqual({
      id,
      url: `https://slovo.example/c/${id}`,
    });
    await expect(keptOf(database, id)).resolves.toEqual({
      id,
      editionId: 'uk',
      name: 'Осінь',
      entryIds: ['w_b2', 'c_a1', 'w_a1'],
      createdAt: made,
    });
  });

  it('answers the link it made as it was shared, with its Entries in their order', async () => {
    const { client } = testApp();

    const { id } = await client.collectionLinks.create(validLink({ name: '  Осінь  ' }));

    await expect(client.collectionLinks.read({ id })).resolves.toEqual({
      edition: 'uk',
      name: 'Осінь',
      entryIds: ['w_b2', 'c_a1', 'w_a1'],
    });
  });

  it('draws another id when the one it drew is taken, and keeps the first link as it was', async () => {
    const [taken, free] = [newLinkId(), newLinkId()];
    const { client } = testApp({ random: drawing(taken, taken, free) });
    await client.collectionLinks.create(validLink({ name: 'Перша' }));

    await expect(client.collectionLinks.create(validLink({ name: 'Друга' }))).resolves.toEqual({
      id: free,
      url: `https://slovo.example/c/${free}`,
    });
    await expect(client.collectionLinks.read({ id: taken })).resolves.toMatchObject({
      name: 'Перша',
    });
  });

  it('makes a new link each time the same Collection is shared', async () => {
    const { client } = testApp();

    const first = await client.collectionLinks.create(validLink());
    const second = await client.collectionLinks.create(validLink());

    expect(second.id).not.toBe(first.id);
    expect(first.id).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it('keeps no IP address, device id or Account, even from a signed-in device', async () => {
    const id = newLinkId();
    const { request, database, ip } = testApp({ random: drawing(id) });

    const response = await request(
      '/v1/collection-links',
      post(validLink(), {
        authorization: 'Bearer a-session-token',
        'x-forwarded-for': '203.0.113.7',
      }),
    );

    expect(response.status).toBe(200);
    const row = await keptOf(database, id);
    // The row holds the Collection and its time, and nothing that names who shared it.
    expect(Object.keys(row ?? {}).sort()).toEqual([
      'createdAt',
      'editionId',
      'entryIds',
      'id',
      'name',
    ]);
    const kept = JSON.stringify(row);
    expect(kept).not.toContain(ip);
    expect(kept).not.toContain('203.0.113.7');
    expect(kept).not.toContain('a-session-token');
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a name of spaces only', { name: '   ' }],
    ['a name over 60 characters', { name: 'а'.repeat(61) }],
    ['no Entries', { entryIds: [] }],
    ['over 200 Entries', { entryIds: Array.from({ length: 201 }, (_, n) => `w_${String(n)}`) }],
    ['an Entry twice', { entryIds: ['w_a1', 'w_b2', 'w_a1'] }],
    ['an Entry id that is not one', { entryIds: ['not-an-entry-id'] }],
    ['an Edition id that is not one', { edition: 'UK' }],
    ['a device id', { deviceId: 'device-1' }],
    ['an Account', { accountId: 'account-1' }],
  ])('refuses a Collection with %s as 400 and keeps nothing', async (_, change) => {
    const id = newLinkId();
    const { request, database } = testApp({ random: drawing(id) });

    const response = await request('/v1/collection-links', post({ ...validLink(), ...change }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(keptOf(database, id)).resolves.toBeUndefined();
  });

  it('takes a name of 60 characters and 200 Entries', async () => {
    const { client } = testApp();
    const link = validLink({
      name: 'а'.repeat(60),
      entryIds: Array.from({ length: 200 }, (_, n) => `w_${String(n)}`),
    });

    const { id } = await client.collectionLinks.create(link);

    await expect(client.collectionLinks.read({ id })).resolves.toEqual(link);
  });

  it('answers an Edition it does not serve as NOT_FOUND and keeps nothing', async () => {
    const id = newLinkId();
    const { client, database } = testApp({ random: drawing(id) });

    await expect(client.collectionLinks.create(validLink({ edition: 'xx' }))).rejects.toMatchObject(
      { code: 'NOT_FOUND', status: 404 },
    );
    await expect(keptOf(database, id)).resolves.toBeUndefined();
  });

  it('builds the link on the domain of the link’s own Edition', async () => {
    const id = newLinkId();
    const folder = testEditions(['pl'], (config) => ({
      ...config,
      linkDomain: 'pl.slovo.example',
    }));
    const { client } = testApp({ editions: folder.read(), random: drawing(id) });

    await expect(
      client.collectionLinks.create(validLink({ edition: 'pl' })),
    ).resolves.toMatchObject({ url: `https://pl.slovo.example/c/${id}` });
  });
});

describe('collectionLinks.read', () => {
  it('answers an unknown link as NOT_FOUND', async () => {
    const { client } = testApp();

    await expect(client.collectionLinks.read({ id: newLinkId() })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it.each(['short', 'aZ3kQ9mB0x1', 'aZ3kQ9mB0-'])(
    'refuses %s, which is not a link id, as 400',
    async (id) => {
      const { request } = testApp();

      const response = await request(`/v1/collection-links/${id}`);

      expect(response.status).toBe(400);
    },
  );

  it('needs no Account and reads the same for a signed-in device', async () => {
    const { client, request } = testApp();
    const { id } = await client.collectionLinks.create(validLink());

    const response = await request(`/v1/collection-links/${id}`, {
      headers: { authorization: 'Bearer a-session-token' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(validLink());
  });
});

describe('a Collection Link', () => {
  it.each(['PUT', 'PATCH', 'DELETE'])(
    'cannot be changed by %s: it reads as it was shared',
    async (method) => {
      const { client, request, database } = testApp();
      const { id } = await client.collectionLinks.create(validLink());
      const before = await keptOf(database, id);

      const response = await request(`/v1/collection-links/${id}`, {
        ...post(validLink({ name: 'Змінена', entryIds: ['w_z9'] })),
        method,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      await expect(keptOf(database, id)).resolves.toEqual(before);
      await expect(client.collectionLinks.read({ id })).resolves.toEqual(validLink());
    },
  );

  it('cannot be overwritten by a second link that draws its id', async () => {
    const id = newLinkId();
    const { client } = testApp({ random: drawing(id, id) });
    await client.collectionLinks.create(validLink());

    // The second draws the taken id, then nothing: it fails rather than overwrite.
    await expect(client.collectionLinks.create(validLink({ name: 'Інша' }))).rejects.toMatchObject({
      status: 500,
    });
    await expect(client.collectionLinks.read({ id })).resolves.toEqual(validLink());
  });
});

describe('Collection Links switched off', () => {
  it('in the Edition answer both requests as NOT_FOUND and keep nothing', async () => {
    const id = newLinkId();
    const folder = testEditions(['off'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, collectionLinks: false },
    }));
    const { client, database } = testApp({ editions: folder.read(), random: drawing(id) });

    await expect(
      client.collectionLinks.create(validLink({ edition: 'off' })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(keptOf(database, id)).resolves.toBeUndefined();
  });

  it('remotely answer both requests as NOT_FOUND, and the links read again once cleared', async () => {
    const { client, switchOff, clearSwitch } = testApp({
      editions: testEditions(['remote']).read(),
    });
    const { id } = await client.collectionLinks.create(validLink({ edition: 'remote' }));
    await switchOff('remote', 'collectionLinks');

    await expect(
      client.collectionLinks.create(validLink({ edition: 'remote' })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(client.collectionLinks.read({ id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });

    await clearSwitch('remote', 'collectionLinks');
    await expect(client.collectionLinks.read({ id })).resolves.toEqual(
      validLink({ edition: 'remote' }),
    );
  });
});

describe('the links from one IP address', () => {
  it('are at most 20 a day: the 21st is TOO_MANY_REQUESTS with Retry-After, and keeps nothing', async () => {
    const { client, request, database } = testApp();
    const name = newName();
    for (let made = 0; made < 20; made++) {
      await client.collectionLinks.create(validLink({ name }));
    }
    passTime(DAY / 2);

    const twentyFirst = await request('/v1/collection-links', post(validLink({ name })));

    expect(twentyFirst.status).toBe(429);
    await expect(twentyFirst.json()).resolves.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
    });
    expect(twentyFirst.headers.get('retry-after')).toBe(String(DAY / 2 / 1000));
    await expect(keptNamed(database, name)).resolves.toHaveLength(20);
  });

  it('hold back no other IP address, and are taken again the next day', async () => {
    const { client, clientFrom, database } = testApp();
    const name = newName();
    for (let made = 0; made < 20; made++) {
      await client.collectionLinks.create(validLink({ name }));
    }
    await expect(client.collectionLinks.create(validLink({ name }))).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    await clientFrom(newIp()).collectionLinks.create(validLink({ name }));
    passTime(DAY);
    await client.collectionLinks.create(validLink({ name }));
    await expect(keptNamed(database, name)).resolves.toHaveLength(22);
  });

  it('count no link to an Edition that does not serve them', async () => {
    const { client } = testApp();
    for (let made = 0; made < 20; made++) {
      await expect(
        client.collectionLinks.create(validLink({ edition: 'xx' })),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }

    const { id } = await client.collectionLinks.create(validLink());
    await expect(client.collectionLinks.read({ id })).resolves.toEqual(validLink());
  });

  it('may read links without a limit', async () => {
    const { client } = testApp();
    const { id } = await client.collectionLinks.create(validLink());
    for (let read = 0; read < 25; read++) {
      await client.collectionLinks.read({ id });
    }

    await expect(client.collectionLinks.read({ id })).resolves.toEqual(validLink());
  });

  it('are counted in a window that names no IP address', async () => {
    const { clientFrom, database } = testApp();
    const ip = '2001:db8:9:58::15';
    await clientFrom(ip).collectionLinks.create(validLink());

    const keys = (await database.db.select({ key: rateLimits.key }).from(rateLimits)).map(
      (row) => row.key,
    );
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const key of keys) {
      expect(key).not.toContain('2001:db8');
      expect(key).not.toContain(':');
    }
  });
});
