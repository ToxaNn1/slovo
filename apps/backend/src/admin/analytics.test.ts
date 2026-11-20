import { randomInt } from 'node:crypto';

import { POSTHOG_FRESH_FOR_MS } from '@slovo/server-core';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createDatabase } from '../database/database';
import {
  createTestDatabase,
  importedDatabases,
  passTime,
  signedInAdmin,
  silentLogger,
  testApp,
  testDatabaseUrl,
  testEditions,
} from '../test-support';

/** An Edition id no other test of the file uses, since they share a database. */
const newEditionId = () => `an${randomInt(2 ** 40).toString(36)}`;
const PERIOD = { from: '2026-11-01', to: '2026-11-07' };

/** A backend serving two Editions of their own, and an Адмін signed in to it. */
async function analyticsBackend() {
  const ids = [newEditionId(), newEditionId()] as const;
  const app = testApp({ editions: testEditions(ids).read() });
  // The admin is on once a Власник exists; an Адмін reads the Аналітика.
  await signedInAdmin(app, 'owner');
  const { client } = await signedInAdmin(app, 'admin');
  return { app, client, ids };
}

/** Lets the queries waiting in the queue start. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('the Аналітика reads', () => {
  it('answer the PostHog aggregates of the Edition and period, with when they were read', async () => {
    const { app, client, ids } = await analyticsBackend();
    app.posthog.answer('activeByDay', [{ key: '2026-11-01', count: 12 }]);
    app.posthog.answer('visitsByDay', [{ key: '2026-11-01', count: 30 }]);
    app.posthog.answer('visitSeconds', [{ key: 'median', count: 184.4 }]);
    app.posthog.answer('devices', [
      { key: 'ios', count: 8 },
      { key: 'android', count: 4 },
    ]);
    app.posthog.answer('appVersions', [{ key: '1.4.0', count: 12 }]);

    const overview = await client.admin.analytics({ editionId: ids[0], ...PERIOD });

    expect(overview).toEqual({
      activeByDay: [{ key: '2026-11-01', count: 12 }],
      visitsByDay: [{ key: '2026-11-01', count: 30 }],
      medianVisitSeconds: 184,
      devices: [
        { key: 'ios', count: 8 },
        { key: 'android', count: 4 },
      ],
      appVersions: [{ key: '1.4.0', count: 12 }],
      fetchedAt: new Date().toISOString(),
    });
    expect(app.posthog.asked).toContainEqual({
      kind: 'activeByDay',
      editionIds: [ids[0]],
      period: PERIOD,
    });
  });

  it('read every Edition served for `all`', async () => {
    const { app, client, ids } = await analyticsBackend();
    await client.admin.analytics({ editionId: 'all', ...PERIOD });
    expect(app.posthog.asked.map(({ editionIds }) => [...editionIds].sort())).toContainEqual(
      [...ids].sort(),
    );
  });

  it('run at most 3 PostHog queries at once: a fourth waits for one to end', async () => {
    const { app, client, ids } = await analyticsBackend();
    app.posthog.hold();

    const read = client.admin.analytics({ editionId: ids[0], ...PERIOD });
    await vi.waitFor(() => {
      expect(app.posthog.asked).toHaveLength(3);
    });
    await settle();
    expect(app.posthog.asked).toHaveLength(3);

    app.posthog.release();
    await vi.waitFor(() => {
      expect(app.posthog.asked).toHaveLength(4);
    });
    expect(app.posthog.running()).toBe(3);

    app.posthog.releaseAll();
    await read;
    expect(app.posthog.asked).toHaveLength(5);
  });

  it('answer the cache within the freshness, and read PostHog again after it', async () => {
    const { app, client, ids } = await analyticsBackend();
    const read = () => client.admin.analytics({ editionId: ids[0], ...PERIOD });
    const first = await read();
    const asked = app.posthog.asked.length;

    passTime(POSTHOG_FRESH_FOR_MS - 1000);
    const cached = await read();
    expect(app.posthog.asked).toHaveLength(asked);
    expect(cached.fetchedAt).toBe(first.fetchedAt);

    passTime(2000);
    const fresh = await read();
    expect(app.posthog.asked).toHaveLength(asked * 2);
    expect(fresh.fetchedAt).toBe(new Date().toISOString());
  });

  it('answer «PostHog недоступний» while PostHog can not answer', async () => {
    const { app, client, ids } = await analyticsBackend();
    app.posthog.down(true);
    await expect(client.admin.analytics({ editionId: ids[0], ...PERIOD })).rejects.toMatchObject({
      code: 'ANALYTICS_UNAVAILABLE',
      status: 503,
    });
  });

  it('answer the people of each Variant of an A/B switch', async () => {
    const { app, client, ids } = await analyticsBackend();
    app.posthog.answer('variants', [
      { key: 'a', count: 40 },
      { key: 'b', count: 38 },
    ]);
    const result = await client.admin.variantResults({ editionId: ids[0], feature: 'dailyGoal' });
    expect(result).toEqual({
      variants: [
        { key: 'a', count: 40 },
        { key: 'b', count: 38 },
      ],
      fetchedAt: new Date().toISOString(),
    });
    expect(app.posthog.asked).toEqual([
      { kind: 'variants', editionIds: [ids[0]], feature: 'dailyGoal' },
    ]);
  });

  it('answer 404 for an Edition the backend does not serve', async () => {
    const { client } = await analyticsBackend();
    await expect(client.admin.analytics({ editionId: 'nowhere', ...PERIOD })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });
});

describe('the Якість read', () => {
  it('answers 404 for an Edition the backend does not serve, and asks Sentry nothing', async () => {
    const { app, client, ids } = await analyticsBackend();

    await expect(
      client.admin.quality({ editionId: 'nowhere', period: '7d' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(app.sentry.asked).toEqual([]);
    await expect(client.admin.quality({ editionId: ids[0], period: '7d' })).resolves.toMatchObject({
      capped: false,
    });
    expect(app.sentry.asked).not.toEqual([]);
  });
});

/** Every key of the value, at any depth. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
}

/** Every string of the value, at any depth. */
function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(stringsOf);
}

describe('no Аналітика read', () => {
  it('answers a list of people or any identifier', async () => {
    const { app, client, ids } = await analyticsBackend();
    for (const kind of [
      'activeByDay',
      'visitsByDay',
      'devices',
      'appVersions',
      'variants',
    ] as const) {
      app.posthog.answer(kind, [{ key: 'k', count: 1 }]);
    }
    await client.counters.questionnaire({
      editionId: ids[0],
      question: 'level',
      answer: 'only-starting',
    });
    const answers = [
      await client.admin.analytics({ editionId: 'all', ...PERIOD }),
      await client.admin.variantResults({ editionId: 'all', feature: 'dailyGoal' }),
      await client.admin.counters({ editionId: 'all' }),
      await client.admin.readerCounts({ editionId: 'all', ...PERIOD }),
    ];
    const allowed = new Set([
      'activeByDay',
      'visitsByDay',
      'medianVisitSeconds',
      'devices',
      'appVersions',
      'fetchedAt',
      'variants',
      'key',
      'count',
      'known',
      'unknown',
      'saved',
      'answers',
      'question',
      'answer',
      'top',
      'entryId',
      'lemma',
      'registered',
      'unregisteredAtLeast',
      'statisticsOff',
      'syncing',
    ]);
    expect(keysOf(answers).filter((key) => !allowed.has(key))).toEqual([]);
    const people = stringsOf(answers).filter((text) => /@|^[0-9a-f-]{32,}$|^ins_/i.test(text));
    expect(people).toEqual([]);
  });
});

/**
 * A backend on a database of its own, so it counts only the Accounts of the
 * test, serving two Editions, with an Адмін signed in and a way to give a
 * reader an Account.
 */
async function readersBackend() {
  const own = await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  const ids = [newEditionId(), newEditionId()] as const;
  const app = testApp({ database, editions: testEditions(ids).read() });
  await signedInAdmin(app, 'owner');
  const { client } = await signedInAdmin(app, 'admin');
  /** Gives the email an Account; the client of a device signed in to it. */
  const register = async (email: string) => {
    await app.client.account.requestCode({ email, editionId: ids[0] });
    const { token } = await app.client.account.verifyCode({
      email,
      code: app.mailer.codeSentTo(email),
    });
    return app.clientOf(token);
  };
  return { app, client, ids, register };
}

describe('the reader counts', () => {
  it('count the Accounts, whatever the Edition filter, and the people active on the newest day beyond them', async () => {
    const { app, client, ids, register } = await readersBackend();
    await register('anna@example.com');
    await register('boris@example.com');
    app.posthog.answer('activeByDay', [
      { key: '2026-11-06', count: 40 },
      { key: '2026-11-07', count: 7 },
    ]);

    const counts = await client.admin.readerCounts({ editionId: ids[1], ...PERIOD });

    expect(counts).toEqual({ registered: 2, unregisteredAtLeast: 5, statisticsOff: 0, syncing: 0 });
    expect(app.posthog.asked).toContainEqual({
      kind: 'activeByDay',
      editionIds: [ids[1]],
      period: PERIOD,
    });
    await expect(client.admin.readerCounts({ editionId: 'all', ...PERIOD })).resolves.toMatchObject(
      { registered: 2 },
    );
  });

  it('never estimate fewer than 0 unregistered readers', async () => {
    const { app, client, ids, register } = await readersBackend();
    await register('anna@example.com');
    await register('boris@example.com');
    app.posthog.answer('activeByDay', [{ key: '2026-11-07', count: 1 }]);

    await expect(client.admin.readerCounts({ editionId: ids[0], ...PERIOD })).resolves.toEqual({
      registered: 2,
      unregisteredAtLeast: 0,
      statisticsOff: 0,
      syncing: 0,
    });
  });

  it('answer no estimate while PostHog can not answer, and the other counts still', async () => {
    const { app, client, ids, register } = await readersBackend();
    await register('anna@example.com');
    app.posthog.down(true);

    await expect(client.admin.readerCounts({ editionId: ids[0], ...PERIOD })).resolves.toEqual({
      registered: 1,
      unregisteredAtLeast: null,
      statisticsOff: 0,
      syncing: 0,
    });
  });

  it('sum the switch-offs of the Edition filter over the period', async () => {
    const { app, client, ids } = await readersBackend();
    const switchOffOn = async (day: string, editionId: string) => {
      vi.setSystemTime(new Date(`${day}T12:00:00Z`));
      await app.client.counters.statisticsOff({ editionId });
    };
    await switchOffOn('2026-10-31', ids[0]);
    await switchOffOn('2026-11-01', ids[0]);
    await switchOffOn('2026-11-07', ids[0]);
    await switchOffOn('2026-11-07', ids[0]);
    await switchOffOn('2026-11-08', ids[0]);
    await switchOffOn('2026-11-03', ids[1]);

    const switchOffs = async (editionId: string) =>
      (await client.admin.readerCounts({ editionId, ...PERIOD })).statisticsOff;
    await expect(switchOffs(ids[0])).resolves.toBe(3);
    await expect(switchOffs(ids[1])).resolves.toBe(1);
    await expect(switchOffs('all')).resolves.toBe(4);
  });

  it("estimate the unregistered readers from the period's newest day, a day with no row as none active", async () => {
    const { app, client, ids, register } = await readersBackend();
    await register('anna@example.com');
    const unregistered = async () =>
      (await client.admin.readerCounts({ editionId: ids[0], ...PERIOD })).unregisteredAtLeast;
    app.posthog.answer('activeByDay', [
      { key: '2026-11-07', count: 9 },
      { key: '2026-11-06', count: 40 },
    ]);
    await expect(unregistered()).resolves.toBe(8);

    passTime(POSTHOG_FRESH_FOR_MS + 1);
    app.posthog.answer('activeByDay', [{ key: '2026-11-06', count: 40 }]);
    await expect(unregistered()).resolves.toBe(0);
  });

  it('count the Accounts with Sync records in the Edition filter, a tombstone alone not one', async () => {
    const { client, ids, register } = await readersBackend();
    // Long past, so the server's own time never caps it.
    const at = Date.parse('2026-01-01T00:00:00.000Z');
    const anna = await register('anna@example.com');
    await anna.sync.push({
      editionId: ids[0],
      changes: [{ key: 'favorites.w_a1', value: '2026-11-01T10:00:00.000Z', changedAt: at }],
    });
    const boris = await register('boris@example.com');
    await boris.sync.push({
      editionId: ids[0],
      changes: [{ key: 'favorites.w_a1', value: '2026-11-01T10:00:00.000Z', changedAt: at }],
    });
    await boris.sync.push({
      editionId: ids[1],
      changes: [{ key: 'favorites.w_a1', value: '2026-11-01T10:00:00.000Z', changedAt: at }],
    });
    const clara = await register('clara@example.com');
    await clara.sync.push({
      editionId: ids[1],
      changes: [{ key: 'hidden.w_c3', value: null, changedAt: at }],
    });
    await register('dmytro@example.com');

    const syncing = async (editionId: string) =>
      (await client.admin.readerCounts({ editionId, ...PERIOD })).syncing;
    await expect(syncing(ids[0])).resolves.toBe(2);
    await expect(syncing(ids[1])).resolves.toBe(1);
    await expect(syncing('all')).resolves.toBe(2);
  });
});

describe('the Counters read', () => {
  it('sums the Community Counters and the questionnaire answers stored, per Edition and for all', async () => {
    const { client, ids } = await analyticsBackend();
    const event = (entryId: string, change: { known?: 1; unknown?: 1; saved?: 1 }) =>
      ({ entryId, known: 0, unknown: 0, saved: 0, ...change }) as const;
    await client.counters.send({
      editionId: ids[0],
      events: [event('w_a', { known: 1, saved: 1 }), event('w_b', { unknown: 1 })],
    });
    await client.counters.send({ editionId: ids[0], events: [event('w_a', { known: 1 })] });
    await client.counters.send({ editionId: ids[1], events: [event('w_c', { saved: 1 })] });
    await client.counters.questionnaire({
      editionId: ids[0],
      question: 'level',
      answer: 'only-starting',
    });
    await client.counters.questionnaire({
      editionId: ids[1],
      question: 'level',
      answer: 'only-starting',
    });

    expect(await client.admin.counters({ editionId: ids[0] })).toEqual({
      known: 2,
      unknown: 1,
      saved: 1,
      // These Entries are in no content database, so no Word of them is named.
      top: { known: [], unknown: [], saved: [] },
      answers: [{ question: 'level', answer: 'only-starting', count: 1 }],
    });
    const all = await client.admin.counters({ editionId: 'all' });
    expect(all).toMatchObject({ known: 2, unknown: 1, saved: 2 });
    expect(all.answers).toEqual([{ question: 'level', answer: 'only-starting', count: 2 }]);
  });
});

const importedDatabase = importedDatabases();

describe('the top Words of the Counters', () => {
  it('names the Words most marked «Не знаю», «Знаю» and kept in Favorites by their Lemma, the most first', async () => {
    const own = await importedDatabase();
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    const app = testApp({ database });
    await signedInAdmin(app, 'owner');
    const { client: admin } = await signedInAdmin(app, 'admin');
    const words = (await app.client.content.snapshot({ editionId: 'uk' })).words;
    const [one, two, three] = words;
    if (one === undefined || two === undefined || three === undefined) {
      throw new Error('too few Words');
    }
    const event = (entryId: string, change: { known?: 1; unknown?: 1; saved?: 1 }) =>
      ({ entryId, known: 0, unknown: 0, saved: 0, ...change }) as const;
    // Each send stands for one reader; an Idiom is counted but is no Word.
    for (const events of [
      [event(one.id, { unknown: 1 }), event(two.id, { unknown: 1, saved: 1 })],
      [event(two.id, { unknown: 1 }), event(three.id, { known: 1 })],
      [event(two.id, { unknown: 1 }), event('i_notaword', { unknown: 1 })],
    ]) {
      await app.client.counters.send({ editionId: 'uk', events });
    }

    const { top } = await admin.admin.counters({ editionId: 'uk' });

    expect(top).toEqual({
      unknown: [
        { entryId: two.id, lemma: two.lemma, count: 3 },
        { entryId: one.id, lemma: one.lemma, count: 1 },
      ],
      known: [{ entryId: three.id, lemma: three.lemma, count: 1 }],
      saved: [{ entryId: two.id, lemma: two.lemma, count: 1 }],
    });
    expect((await admin.admin.counters({ editionId: 'all' })).top).toEqual(top);
  });
});
