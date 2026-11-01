import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  userStateRecords,
  type AnalyticsPort,
  type FeatureSwitch,
  type XpRecord,
} from '../index';
import type { Badge } from '@slovo/contracts';

import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word } from '../test-support';

// Spec #1358, ticket #1384: the progress Share Cards on offer today, a Level
// reached, a Badge earned and a Streak milestone, each on its own day only.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index)}`)),
});
const ALL_ON: readonly FeatureSwitch[] = [
  'game',
  'xpLog',
  'levels',
  'badges',
  'shareCards',
  'progressShareCards',
  'analytics',
];
const badges: readonly Badge[] = [
  { id: 'streak-3', name: 'Three days', condition: { kind: 'streak', days: 3 } },
];
const TODAY = '2026-10-14';

const at = (date: string) => new Date(`${date}T08:00:00+03:00`).toISOString();
const xp = (date: string, amount: number): XpRecord => ({
  kind: 'xp',
  date,
  at: at(date),
  source: 'game-round',
  amount,
});

async function run({
  xps,
  off = [],
  events = [],
  sharing = true,
}: {
  xps: readonly XpRecord[];
  off?: readonly FeatureSwitch[];
  events?: unknown[][];
  sharing?: boolean;
}) {
  const records = new Map<string, string>();
  const seeded = await openUserState({ port: createMemoryUserStatePort(records) });
  for (const [index, record] of xps.entries()) {
    await seeded.write(userStateRecords.xpLog.record(`seeded-${String(index)}`).change(record));
  }
  if (!sharing) await seeded.write(userStateRecords.shareCounters.change(false));
  const port: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => ALL_ON.includes(feature) && !off.includes(feature),
      badges,
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock(`${TODAY}T09:00:00+03:00`).clock,
    random: seededRandom(7),
    analytics: port,
  });
  await Promise.resolve();
  return app;
}

describe('the progress Share Cards', () => {
  it('offers the Level reached, the Badge earned and the Streak milestone of today', async () => {
    // Level 1 takes 50 XP: 30 two days ago, 10 yesterday, 10 today; 3 Active Days in a row.
    const app = await run({ xps: [xp('2026-10-12', 30), xp('2026-10-13', 10), xp(TODAY, 10)] });
    const cards = app.progressShareCards.state;
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ level: { level: 1, name: 'Seed' }, date: TODAY });
    expect(cards[1]).toMatchObject({ badge: { id: 'streak-3', name: 'Three days', date: TODAY } });
    expect(cards[2]).toEqual({ streak: 3, date: TODAY });
  });

  it('offers none of a Level, a Badge or a Streak milestone reached before today', async () => {
    const app = await run({
      // Level 1 on 12 October; 2 Active Days in a row up to yesterday, too few for the Badge.
      xps: [xp('2026-10-10', 30), xp('2026-10-12', 30), xp('2026-10-13', 10)],
    });
    expect(app.progressShareCards.state).toEqual([]);
  });

  it('offers no Streak past its milestones: 8 days in a row is none', async () => {
    const days = ['07', '08', '09', '10', '11', '12', '13', '14'];
    const app = await run({ xps: days.map((day) => xp(`2026-10-${day}`, 5)) });
    expect(app.progressShareCards.state.some((card) => 'streak' in card)).toBe(false);
  });

  it('offers no Streak until today is an Active Day', async () => {
    const app = await run({ xps: [xp('2026-10-12', 5), xp('2026-10-13', 5), xp(TODAY, 4)] });
    expect(app.progressShareCards.state.some((card) => 'streak' in card)).toBe(false);
  });

  it('keeps one state while nothing changes', async () => {
    const app = await run({ xps: [xp(TODAY, 5)] });
    expect(app.progressShareCards.state).toEqual([{ streak: 1, date: TODAY }]);
    expect(app.progressShareCards.state).toBe(app.progressShareCards.state);
  });

  it('offers none with its Feature Switch or the XP log off', async () => {
    const xps = [xp('2026-10-12', 30), xp('2026-10-13', 10), xp(TODAY, 10)];
    expect((await run({ xps, off: ['progressShareCards'] })).progressShareCards.state).toEqual([]);
    expect((await run({ xps, off: ['xpLog'] })).progressShareCards.state).toEqual([]);
  });
});

describe('the Share Card analytics', () => {
  it('sends which card was shared, and nothing while «Ділитися анонімною статистикою» is off', async () => {
    const events: unknown[][] = [];
    const app = await run({ xps: [], events });
    await app.analytics.shareCardShared('streak');
    expect(events).toContainEqual(['shareCardShared', { card: 'streak' }]);

    const silent: unknown[][] = [];
    const off = await run({ xps: [], events: silent, sharing: false });
    await off.analytics.shareCardShared('streak');
    expect(silent.filter(([event]) => event === 'shareCardShared')).toEqual([]);
  });
});
