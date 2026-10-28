import { randomInt } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { Database } from '../database/database';
import { communityCounters } from '../database/schema';
import { testApp, testEditions } from '../test-support';

/**
 * A Word id no other test counts, since the tests of the file share its
 * database: the backend doesn't check that the Entry is in a pack.
 */
const newEntryId = () => `w_${randomInt(2 ** 47).toString(36)}`;

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
