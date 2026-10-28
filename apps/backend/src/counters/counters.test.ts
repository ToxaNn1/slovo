import { randomInt } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../database/database';
import { communityCounters, favoritesAdds, rateLimits } from '../database/schema';
import { newIp, passTime, testApp, testEditions } from '../test-support';

/**
 * A Word id no other test counts, since the tests of the file share its
 * database: the backend doesn't check that the Entry is in a pack.
 */
const newEntryId = () => `w_${randomInt(2 ** 47).toString(36)}`;

const DAY = 24 * 60 * 60 * 1000;

type Delta = -1 | 0 | 1;

/** An event of the Entry, changing nothing unless told. */
const event = (entryId: string, change: { known?: Delta; unknown?: Delta; saved?: Delta } = {}) =>
  ({ entryId, known: 0, unknown: 0, saved: 0, ...change }) as const;

/** A request's body as JSON, for a test that sends its own request. */
const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

/** What the database keeps of the Entry's counters in the Edition: none, or its counts. */
async function countsOf({ db }: Database, entryId: string, editionId = 'uk') {
  const rows = await db
    .select()
    .from(communityCounters)
    .where(and(eq(communityCounters.editionId, editionId), eq(communityCounters.entryId, entryId)));
  return rows.map(({ known, unknown, saved }) => ({ known, unknown, saved }));
}

/** What the database keeps of the Entry's Favorites adds in the Edition: each ISO week by its Monday, oldest first. */
async function weeklyAddsOf({ db }: Database, entryId: string, editionId = 'uk') {
  const rows = await db
    .select()
    .from(favoritesAdds)
    .where(and(eq(favoritesAdds.editionId, editionId), eq(favoritesAdds.entryId, entryId)))
    .orderBy(favoritesAdds.week);
  return rows.map(({ week, adds }) => ({ week, adds }));
}

describe('counters.send', () => {
  it('adds the deltas of every event to the Entry’s counts and answers 202 with no body', async () => {
    const { request, database } = testApp();
    const word = newEntryId();
    const other = newEntryId();

    const response = await request(
      '/v1/counters/events',
      post({
        editionId: 'uk',
        events: [event(word, { known: 1, saved: 1 }), event(other, { unknown: 1 })],
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe('');
    await expect(countsOf(database, word)).resolves.toEqual([{ known: 1, unknown: 0, saved: 1 }]);
    await expect(countsOf(database, other)).resolves.toEqual([{ known: 0, unknown: 1, saved: 0 }]);
  });

  it('sums the deltas of many devices', async () => {
    const { client, database } = testApp();
    const word = newEntryId();

    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1 })] });
    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1, saved: 1 })] });
    await client.counters.send({ editionId: 'uk', events: [event(word, { unknown: 1 })] });

    await expect(countsOf(database, word)).resolves.toEqual([{ known: 2, unknown: 1, saved: 1 }]);
  });

  it('moves one from known to unknown, and back', async () => {
    const { client, database } = testApp();
    const word = newEntryId();
    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1 })] });

    await client.counters.send({
      editionId: 'uk',
      events: [event(word, { known: -1, unknown: 1 })],
    });
    await expect(countsOf(database, word)).resolves.toEqual([{ known: 0, unknown: 1, saved: 0 }]);

    await client.counters.send({
      editionId: 'uk',
      events: [event(word, { known: 1, unknown: -1 })],
    });
    await expect(countsOf(database, word)).resolves.toEqual([{ known: 1, unknown: 0, saved: 0 }]);
  });

  it('takes one away when a mark or a Favorite is removed', async () => {
    const { client, database } = testApp();
    const word = newEntryId();
    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1, saved: 1 })] });
    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1, saved: 1 })] });

    await client.counters.send({
      editionId: 'uk',
      events: [event(word, { known: -1, saved: -1 })],
    });

    await expect(countsOf(database, word)).resolves.toEqual([{ known: 1, unknown: 0, saved: 1 }]);
  });

  it('never takes a count below zero', async () => {
    const { client, database } = testApp();
    const counted = newEntryId();
    const neverCounted = newEntryId();
    await client.counters.send({ editionId: 'uk', events: [event(counted, { unknown: 1 })] });

    await client.counters.send({
      editionId: 'uk',
      events: [
        event(counted, { known: 1, unknown: -1, saved: -1 }),
        event(neverCounted, { known: -1, saved: -1 }),
      ],
    });
    await client.counters.send({
      editionId: 'uk',
      events: [event(counted, { unknown: -1 }), event(neverCounted, { known: 1 })],
    });

    await expect(countsOf(database, counted)).resolves.toEqual([
      { known: 1, unknown: 0, saved: 0 },
    ]);
    // Had the removal gone below zero, the new mark would bring the count back to zero only.
    await expect(countsOf(database, neverCounted)).resolves.toEqual([
      { known: 1, unknown: 0, saved: 0 },
    ]);
  });

  it('keeps the counts of each Edition apart', async () => {
    const { client, database } = testApp({ editions: testEditions(['uk', 'other']).read() });
    const word = newEntryId();

    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1 })] });
    await client.counters.send({ editionId: 'other', events: [event(word, { saved: 1 })] });

    await expect(countsOf(database, word, 'uk')).resolves.toEqual([
      { known: 1, unknown: 0, saved: 0 },
    ]);
    await expect(countsOf(database, word, 'other')).resolves.toEqual([
      { known: 0, unknown: 0, saved: 1 },
    ]);
  });

  it('keeps one row of totals per Entry, which names no reader', async () => {
    const { request, database, ip } = testApp();
    const word = newEntryId();

    for (const from of ['203.0.113.7', '203.0.113.8']) {
      const response = await request(
        '/v1/counters/events',
        post(
          { editionId: 'uk', events: [event(word, { known: 1 })] },
          { authorization: 'Bearer a-session-token', 'x-forwarded-for': from },
        ),
      );
      expect(response.status).toBe(202);
    }

    const rows = await database.db
      .select()
      .from(communityCounters)
      .where(eq(communityCounters.entryId, word));
    // Two readers' changes, one row: the Edition, the Entry and the totals, nothing else.
    expect(rows).toEqual([{ editionId: 'uk', entryId: word, known: 2, unknown: 0, saved: 0 }]);
    const kept = JSON.stringify(rows);
    expect(kept).not.toContain(ip);
    expect(kept).not.toContain('203.0.113');
    expect(kept).not.toContain('a-session-token');
  });

  it.each([
    ['a delta of two', [{ ...event('w_a'), known: 2 }]],
    ['known and unknown added at once', [event('w_a', { known: 1, unknown: 1 })]],
    ['an event that changes nothing', [event('w_a')]],
    ['an Entry twice', [event('w_a', { known: 1 }), event('w_a', { saved: 1 })]],
    ['an Entry id that is not one', [event('not-an-entry-id', { known: 1 })]],
    ['a device id', [{ ...event('w_a', { known: 1 }), deviceId: 'device-1' }]],
  ])('refuses a request with %s as 400 and counts nothing of it', async (_, events) => {
    const { request, database } = testApp();
    const word = newEntryId();

    const response = await request(
      '/v1/counters/events',
      post({ editionId: 'uk', events: [event(word, { known: 1 }), ...events] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(countsOf(database, word)).resolves.toEqual([]);
  });

  it('refuses a request with no event as BAD_REQUEST', async () => {
    const { client } = testApp();

    await expect(client.counters.send({ editionId: 'uk', events: [] })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('answers an Edition it does not serve as NOT_FOUND and counts nothing', async () => {
    const { client, database } = testApp();
    const word = newEntryId();

    await expect(
      client.counters.send({ editionId: 'xx', events: [event(word, { known: 1 })] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(countsOf(database, word, 'xx')).resolves.toEqual([]);
  });

  it('answers an Edition with Community Counters switched off as NOT_FOUND and counts nothing', async () => {
    const folder = testEditions(['off'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, communityCounters: false },
    }));
    const { client, database } = testApp({ editions: folder.read() });
    const word = newEntryId();

    await expect(
      client.counters.send({ editionId: 'off', events: [event(word, { known: 1 })] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(countsOf(database, word, 'off')).resolves.toEqual([]);
  });

  it('answers NOT_FOUND once the owner turns Community Counters off remotely', async () => {
    const { client, database, switchOff } = testApp({
      editions: testEditions(['remote']).read(),
    });
    const word = newEntryId();
    await switchOff('remote', 'communityCounters');

    await expect(
      client.counters.send({ editionId: 'remote', events: [event(word, { known: 1 })] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(countsOf(database, word, 'remote')).resolves.toEqual([]);
  });
});

describe('the Favorites adds of an ISO week', () => {
  it('adds a saved +1 to the ISO week (UTC) it arrives in, across a Sunday/Monday boundary', async () => {
    const { client, database } = testApp();
    const word = newEntryId();
    const save = () =>
      client.counters.send({ editionId: 'uk', events: [event(word, { saved: 1 })] });

    // Monday 26 October 2026 at midnight UTC opens the week.
    vi.setSystemTime(new Date('2026-10-26T00:00:00Z'));
    await save();
    // Sunday 1 November, the last second of the week in UTC, though Monday already in Kyiv.
    vi.setSystemTime(new Date('2026-11-01T23:59:59Z'));
    await save();
    // Monday 2 November at midnight UTC opens the next week.
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    await save();

    await expect(weeklyAddsOf(database, word)).resolves.toEqual([
      { week: '2026-10-26', adds: 2 },
      { week: '2026-11-02', adds: 1 },
    ]);
  });

  it('keeps an ISO week that spans two years under its Monday', async () => {
    const { client, database } = testApp();
    const word = newEntryId();

    vi.setSystemTime(new Date('2027-01-03T12:00:00Z'));
    await client.counters.send({ editionId: 'uk', events: [event(word, { saved: 1 })] });

    await expect(weeklyAddsOf(database, word)).resolves.toEqual([{ week: '2026-12-28', adds: 1 }]);
  });

  it('takes nothing from the adds of a week when a Favorite is removed', async () => {
    const { client, database } = testApp();
    const word = newEntryId();
    vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
    await client.counters.send({ editionId: 'uk', events: [event(word, { saved: 1 })] });

    // Removed in the same week, and again in the next.
    await client.counters.send({ editionId: 'uk', events: [event(word, { saved: -1 })] });
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    await client.counters.send({ editionId: 'uk', events: [event(word, { saved: -1 })] });

    await expect(weeklyAddsOf(database, word)).resolves.toEqual([{ week: '2026-10-26', adds: 1 }]);
    await expect(countsOf(database, word)).resolves.toEqual([{ known: 0, unknown: 0, saved: 0 }]);
  });

  it('counts only Favorites as adds, not marks', async () => {
    const { client, database } = testApp();
    const marked = newEntryId();
    const saved = newEntryId();
    vi.setSystemTime(new Date('2026-10-28T09:00:00Z'));

    await client.counters.send({
      editionId: 'uk',
      events: [event(marked, { known: 1 }), event(saved, { unknown: 1, saved: 1 })],
    });

    await expect(weeklyAddsOf(database, marked)).resolves.toEqual([]);
    await expect(weeklyAddsOf(database, saved)).resolves.toEqual([{ week: '2026-10-26', adds: 1 }]);
  });

  it('keeps the adds of each Edition apart, with no row that names a reader', async () => {
    const { client, database, ip } = testApp({ editions: testEditions(['uk', 'other']).read() });
    const word = newEntryId();
    vi.setSystemTime(new Date('2026-10-28T09:00:00Z'));

    await client.counters.send({ editionId: 'uk', events: [event(word, { saved: 1 })] });
    await client.counters.send({ editionId: 'uk', events: [event(word, { saved: 1 })] });
    await client.counters.send({ editionId: 'other', events: [event(word, { saved: 1 })] });

    const rows = await database.db
      .select()
      .from(favoritesAdds)
      .where(eq(favoritesAdds.entryId, word))
      .orderBy(favoritesAdds.editionId);
    // The Edition, the Entry, the week and the adds, nothing else.
    expect(rows).toEqual([
      { editionId: 'other', entryId: word, week: '2026-10-26', adds: 1 },
      { editionId: 'uk', entryId: word, week: '2026-10-26', adds: 2 },
    ]);
    expect(JSON.stringify(rows)).not.toContain(ip);
  });

  it('adds nothing for a batch refused, or for an Edition with Community Counters switched off', async () => {
    const folder = testEditions(['uk', 'off'], (config) =>
      config.id === 'off'
        ? { ...config, featureSwitches: { ...config.featureSwitches, communityCounters: false } }
        : config,
    );
    const { request, client, database } = testApp({ editions: folder.read() });
    const word = newEntryId();

    await request(
      '/v1/counters/events',
      post({ editionId: 'uk', events: [event(word, { saved: 1 }), { ...event('w_a'), known: 2 }] }),
    );
    await expect(
      client.counters.send({ editionId: 'off', events: [event(word, { saved: 1 })] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(weeklyAddsOf(database, word)).resolves.toEqual([]);
    await expect(weeklyAddsOf(database, word, 'off')).resolves.toEqual([]);
  });
});

describe('the counter events from one IP address', () => {
  /** A batch of `size` events, each of a new Entry known once more. */
  const batch = (size: number) =>
    Array.from({ length: size }, () => event(newEntryId(), { known: 1 }));

  it('are at most 500 a day, each event of a batch counting: the 501st is TOO_MANY_REQUESTS with Retry-After, and counts nothing', async () => {
    const { client, request, database } = testApp();
    for (let sent = 0; sent < 5; sent++) {
      await client.counters.send({ editionId: 'uk', events: batch(100) });
    }
    passTime(DAY / 2);
    const word = newEntryId();

    const next = await request(
      '/v1/counters/events',
      post({ editionId: 'uk', events: [event(word, { known: 1, saved: 1 })] }),
    );

    expect(next.status).toBe(429);
    await expect(next.json()).resolves.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
    });
    expect(next.headers.get('retry-after')).toBe(String(DAY / 2 / 1000));
    await expect(countsOf(database, word)).resolves.toEqual([]);
    await expect(weeklyAddsOf(database, word)).resolves.toEqual([]);
  });

  it('refuse a batch that crosses the limit whole', async () => {
    const { client, database } = testApp();
    for (let sent = 0; sent < 4; sent++) {
      await client.counters.send({ editionId: 'uk', events: batch(100) });
    }
    await client.counters.send({ editionId: 'uk', events: batch(99) });
    const crossing = batch(2);

    await expect(client.counters.send({ editionId: 'uk', events: crossing })).rejects.toMatchObject(
      { code: 'TOO_MANY_REQUESTS', status: 429 },
    );

    for (const { entryId } of crossing) {
      await expect(countsOf(database, entryId)).resolves.toEqual([]);
    }
  });

  it('hold back no other IP address, and are taken again the next day', async () => {
    const { client, clientFrom } = testApp();
    for (let sent = 0; sent < 5; sent++) {
      await client.counters.send({ editionId: 'uk', events: batch(100) });
    }
    await expect(client.counters.send({ editionId: 'uk', events: batch(1) })).rejects.toMatchObject(
      { code: 'TOO_MANY_REQUESTS' },
    );

    await expect(
      clientFrom(newIp()).counters.send({ editionId: 'uk', events: batch(100) }),
    ).resolves.toBeUndefined();
    passTime(DAY);
    await expect(
      client.counters.send({ editionId: 'uk', events: batch(100) }),
    ).resolves.toBeUndefined();
  });

  it('count nothing sent to an Edition that does not serve Community Counters', async () => {
    const { client } = testApp();
    for (let sent = 0; sent < 6; sent++) {
      await expect(
        client.counters.send({ editionId: 'xx', events: batch(100) }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }

    await expect(
      client.counters.send({ editionId: 'uk', events: batch(100) }),
    ).resolves.toBeUndefined();
  });

  it('are counted in a window that names no IP address', async () => {
    const { clientFrom, database } = testApp();
    await clientFrom('2001:db8:9:8::15').counters.send({ editionId: 'uk', events: batch(1) });

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

describe('counters.read', () => {
  it('answers known, unknown and saved of several Entries, in the order asked, cached for 24 hours', async () => {
    const { client, request } = testApp();
    const word = newEntryId();
    const other = newEntryId();
    await client.counters.send({
      editionId: 'uk',
      events: [event(word, { known: 1, saved: 1 }), event(other, { unknown: 1 })],
    });
    await client.counters.send({ editionId: 'uk', events: [event(word, { known: 1 })] });

    const response = await request(`/v1/counters?edition=uk&entries=${other},${word}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    await expect(response.json()).resolves.toEqual({
      counters: [
        { entryId: other, known: 0, unknown: 1, saved: 0 },
        { entryId: word, known: 2, unknown: 0, saved: 1 },
      ],
    });
  });

  it('answers zeros for an Entry never counted, and for one whose counts went back to zero', async () => {
    const { client } = testApp();
    const neverCounted = newEntryId();
    const removed = newEntryId();
    await client.counters.send({ editionId: 'uk', events: [event(removed, { saved: 1 })] });
    await client.counters.send({ editionId: 'uk', events: [event(removed, { saved: -1 })] });

    await expect(
      client.counters.read({ edition: 'uk', entries: [neverCounted, removed].join(',') }),
    ).resolves.toEqual({
      counters: [
        { entryId: neverCounted, known: 0, unknown: 0, saved: 0 },
        { entryId: removed, known: 0, unknown: 0, saved: 0 },
      ],
    });
  });

  it('answers the counts of the Edition asked, not another’s', async () => {
    const { client } = testApp({ editions: testEditions(['uk', 'other']).read() });
    const word = newEntryId();
    await client.counters.send({ editionId: 'other', events: [event(word, { known: 1 })] });

    await expect(client.counters.read({ edition: 'uk', entries: word })).resolves.toEqual({
      counters: [{ entryId: word, known: 0, unknown: 0, saved: 0 }],
    });
  });

  it('answers 100 Entries at once', async () => {
    const { client } = testApp();
    const entries = Array.from({ length: 100 }, newEntryId);

    const { counters } = await client.counters.read({ edition: 'uk', entries: entries.join(',') });

    expect(counters.map(({ entryId }) => entryId)).toEqual(entries);
  });

  it.each([
    ['over 100 Entries', Array.from({ length: 101 }, newEntryId).join(',')],
    ['no Entry', ''],
    ['an Entry twice', 'w_a,w_a'],
    ['an Entry id that is not one', 'w_a,not-an-entry-id'],
  ])('refuses a request with %s as 400', async (_, entries) => {
    const { request } = testApp();

    const response = await request(`/v1/counters?edition=uk&entries=${entries}`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('answers an Edition it does not serve as NOT_FOUND', async () => {
    const { client } = testApp();

    await expect(client.counters.read({ edition: 'xx', entries: 'w_a' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('answers NOT_FOUND for an Edition with Community Counters switched off, locally or remotely', async () => {
    const folder = testEditions(['off', 'remote'], (config) =>
      config.id === 'off'
        ? { ...config, featureSwitches: { ...config.featureSwitches, communityCounters: false } }
        : config,
    );
    const { client, switchOff } = testApp({ editions: folder.read() });
    await switchOff('remote', 'communityCounters');

    for (const edition of ['off', 'remote']) {
      await expect(client.counters.read({ edition, entries: 'w_a' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  });
});
