import { randomInt } from 'node:crypto';

import { POSTHOG_FRESH_FOR_MS } from '@slovo/server-core';
import { describe, expect, it, vi } from 'vitest';

import { passTime, signedInAdmin, testApp, testEditions } from '../test-support';

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
    ]);
    expect(keysOf(answers).filter((key) => !allowed.has(key))).toEqual([]);
    const people = stringsOf(answers).filter((text) => /@|^[0-9a-f-]{32,}$|^ins_/i.test(text));
    expect(people).toEqual([]);
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
      answers: [{ question: 'level', answer: 'only-starting', count: 1 }],
    });
    const all = await client.admin.counters({ editionId: 'all' });
    expect(all).toMatchObject({ known: 2, unknown: 1, saved: 2 });
    expect(all.answers).toEqual([{ question: 'level', answer: 'only-starting', count: 2 }]);
  });
});
