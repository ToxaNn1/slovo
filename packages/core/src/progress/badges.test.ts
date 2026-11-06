import { describe, expect, it } from 'vitest';

import { openComposition, type AnalyticsPort, type FeatureSwitch, type XpRecord } from '../index';
import type { Badge } from '@slovo/contracts';

import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

// Spec #1358, ticket #1378, ADR 0066: Badges from the Core's catalogue of
// conditions, chosen and named by the Edition, kept with their date.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index)}`)),
});
const ALL_ON: readonly FeatureSwitch[] = [
  'game',
  'xpLog',
  'levels',
  'badges',
  'analytics',
  'knowledge',
  'confirmedEntries',
];

const badges: readonly Badge[] = [
  {
    id: 'streak-3',
    name: 'Three days',
    symbol: '1',
    family: 'f',
    condition: { kind: 'streak', days: 3 },
  },
  {
    id: 'win-words',
    name: 'First win',
    symbol: '1',
    family: 'f',
    condition: { kind: 'gameWin', modes: ['guess-word'] },
  },
  {
    id: 'crossword-2',
    name: 'Two crosswords',
    symbol: '1',
    family: 'f',
    condition: { kind: 'dailyCrosswordRun', days: 2 },
  },
  {
    id: 'rare',
    name: 'Rare',
    symbol: '1',
    family: 'f',
    condition: { kind: 'rightOnRarity', rarity: 5 },
  },
  {
    id: 'level-1',
    name: 'Level 1',
    symbol: '1',
    family: 'f',
    condition: { kind: 'level', level: 1 },
  },
  {
    id: 'confirmed-3',
    name: 'Three confirmed',
    symbol: '1',
    family: 'f',
    condition: { kind: 'confirmedEntries', entries: 3 },
  },
  // An Edition's own Badge from a parameterised kind.
  {
    id: 'clean',
    name: 'Clean language',
    symbol: '1',
    family: 'f',
    condition: { kind: 'rightAnswers', modes: ['correction', 'anglicism'], count: 3 },
  },
];

const at = (date: string) => new Date(`${date}T08:00:00+03:00`).toISOString();
const xp = (date: string, amount: number, more: Partial<XpRecord> = {}): XpRecord =>
  ({ kind: 'xp', date, at: at(date), source: 'game-round', amount, ...more }) as XpRecord;

async function readerWith(...xps: readonly XpRecord[]): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  for (const [index, record] of xps.entries()) {
    await userState.write(userStateRecords.xpLog.record(`seeded-${String(index)}`).change(record));
  }
  return records;
}

async function run({
  records = new Map<string, string>(),
  on = '2026-10-14',
  off = [],
}: { records?: Map<string, string>; on?: string; off?: readonly FeatureSwitch[] } = {}) {
  const events: unknown[][] = [];
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
    clock: fakeClock(`${on}T09:00:00+03:00`).clock,
    random: seededRandom(7),
    analytics: port,
  });
  await Promise.resolve();
  return { app, events };
}

const earned = (app: Awaited<ReturnType<typeof run>>['app']) =>
  Object.fromEntries(
    app.badges.state.flatMap((badge) => (badge.earned ? [[badge.id, badge.date]] : [])),
  );
/** Resolves when the Badges next tell their subscribers, after the check a change starts. */
const checked = (app: Awaited<ReturnType<typeof run>>['app']) =>
  new Promise<void>((resolve) => {
    const stop = app.badges.subscribe(() => {
      stop();
      resolve();
    });
  });
const progressOf = (app: Awaited<ReturnType<typeof run>>['app'], id: string) =>
  app.badges.state.find((badge) => badge.id === id);

describe('the Badges', () => {
  it('earns none for a new reader and shows the progress of each', async () => {
    const { app } = await run();
    expect(earned(app)).toEqual({});
    expect(progressOf(app, 'streak-3')).toMatchObject({
      earned: false,
      progress: { current: 0, target: 3 },
    });
  });

  it('earns the Streak Badge at 3 Active Days in a row, not at 2', async () => {
    const two = await readerWith(xp('2026-10-12', 5), xp('2026-10-13', 5));
    const { app } = await run({ records: two });
    expect(progressOf(app, 'streak-3')).toMatchObject({ progress: { current: 2, target: 3 } });

    const three = await readerWith(xp('2026-10-12', 5), xp('2026-10-13', 5), xp('2026-10-14', 5));
    expect(earned((await run({ records: three })).app)).toMatchObject({ 'streak-3': '2026-10-14' });
  });

  it('earns a win, a rarity-5 answer, a crossword run and the Edition-specific Badge at their thresholds', async () => {
    const below = await readerWith(
      xp('2026-10-13', 1, { mode: 'correction' }),
      xp('2026-10-13', 1, { mode: 'anglicism', rarity: 4 }),
      xp('2026-10-13', 15, { source: 'daily-crossword' }),
      xp('2026-10-13', 5, { source: 'game-finished', mode: 'stress' }),
    );
    expect(earned((await run({ records: below })).app)).toEqual({});

    const met = await readerWith(
      xp('2026-10-12', 1, { mode: 'correction' }),
      xp('2026-10-13', 1, { mode: 'anglicism', rarity: 5 }),
      xp('2026-10-13', 1, { mode: 'correction' }),
      xp('2026-10-12', 15, { source: 'daily-crossword' }),
      xp('2026-10-13', 15, { source: 'daily-crossword' }),
      xp('2026-10-13', 5, { source: 'game-finished', mode: 'guess-word' }),
    );
    expect(Object.keys(earned((await run({ records: met })).app)).sort()).toEqual([
      'clean',
      'crossword-2',
      'rare',
      'win-words',
    ]);
  });

  it('keeps an earned Badge with its date when its condition no longer holds', async () => {
    const records = await readerWith(xp('2026-10-12', 5), xp('2026-10-13', 5), xp('2026-10-14', 5));
    await run({ records });

    const { app } = await run({ records, on: '2026-10-30' });
    expect(earned(app)).toMatchObject({ 'streak-3': '2026-10-14' });
    expect(progressOf(app, 'streak-3')).toMatchObject({ earned: true, date: '2026-10-14' });
  });

  it('gives no XP and sends one badgeEarned event', async () => {
    const records = await readerWith(xp('2026-10-14', 50));
    const { app, events } = await run({ records });
    expect(app.xpLog.state.total).toBe(50);
    expect(events).toContainEqual(['badgeEarned', { badge: 'level-1' }]);

    const quiet = await run({
      records: await readerWith(xp('2026-10-14', 50)),
      off: ['analytics'],
    });
    expect(earned(quiet.app)).toMatchObject({ 'level-1': '2026-10-14' });
    expect(quiet.events).toEqual([]);
  });

  it('shows and earns nothing with the badges Feature Switch off', async () => {
    const records = await readerWith(xp('2026-10-14', 50));
    expect((await run({ records, off: ['badges'] })).app.badges.state).toEqual([]);
    expect(earned((await run({ records })).app)).toMatchObject({ 'level-1': '2026-10-14' });
  });

  it('earns the confirmed-Entries Badge at the Nth confirmed Entry, not at N-1, and keeps it', async () => {
    const records = new Map<string, string>();
    const { app } = await run({ records });
    await app.knowledge.confirm('w_0');
    const second = checked(app);
    await app.knowledge.confirm('w_1');
    await second;
    expect(earned(app)).toEqual({});
    expect(progressOf(app, 'confirmed-3')).toMatchObject({
      earned: false,
      progress: { current: 2, target: 3 },
    });

    const third = checked(app);
    await app.knowledge.confirm('w_2');
    await third;
    expect(earned(app)).toEqual({ 'confirmed-3': '2026-10-14' });
    const written = [...records].filter(([key]) => key.startsWith('xp.'));
    expect(written.map(([, value]) => JSON.parse(value) as unknown)).toEqual([
      expect.objectContaining({ kind: 'badge', badge: 'confirmed-3', date: '2026-10-14' }),
    ]);

    for (const key of records.keys()) if (key.startsWith('confirmed.')) records.delete(key);
    const later = (await run({ records, on: '2026-10-30' })).app;
    expect(later.knowledge.state.confirmed.total).toBe(0);
    expect(progressOf(later, 'confirmed-3')).toMatchObject({ earned: true, date: '2026-10-14' });
  });
});

// Ticket #1645, ADR 0085: an earned Badge is new («НОВА») until a
// `badge-opened` record exists, and that record merges by id across devices.
describe('the new Badges', () => {
  const level1 = (app: Awaited<ReturnType<typeof run>>['app']) => progressOf(app, 'level-1');
  const openedRecords = (records: ReadonlyMap<string, string>) =>
    [...records.values()]
      .map((value) => JSON.parse(value) as { kind?: string })
      .filter(({ kind }) => kind === 'badge-opened');

  it('holds «НОВА» on an earned Badge until it is opened, then on no later launch', async () => {
    const records = await readerWith(xp('2026-10-14', 50));
    const { app } = await run({ records });
    expect(level1(app)).toMatchObject({ earned: true, isNew: true });

    await app.badges.open('level-1');
    expect(level1(app)).toMatchObject({ earned: true, isNew: false });
    expect(level1((await run({ records, on: '2026-10-15' })).app)).toMatchObject({
      isNew: false,
    });
  });

  it('writes one badge-opened record however often the Badge is opened, and none for an unearned one', async () => {
    const records = await readerWith(xp('2026-10-14', 50));
    const { app } = await run({ records });
    await app.badges.open('level-1');
    await app.badges.open('level-1');
    await app.badges.open('streak-3');
    expect(openedRecords(records)).toEqual([
      expect.objectContaining({ kind: 'badge-opened', badge: 'level-1', date: '2026-10-14' }),
    ]);
    expect(progressOf(app, 'streak-3')).toMatchObject({ earned: false });
  });

  it('merges the badge-opened records of two devices by id without doubling, with «НОВА» gone on both', async () => {
    const phone = await readerWith(xp('2026-10-14', 50));
    const tablet = new Map(phone);
    await (await run({ records: phone })).app.badges.open('level-1');
    const other = (await run({ records: tablet, on: '2026-10-15' })).app;
    expect(level1(other)).toMatchObject({ isNew: true });
    await other.badges.open('level-1');

    // Sync merges the XP logs as a union by record id.
    const merged = new Map([...phone, ...tablet]);
    expect(openedRecords(merged)).toHaveLength(1);
    const { app } = await run({ records: merged, on: '2026-10-16' });
    expect(level1(app)).toMatchObject({ isNew: false });

    const synced = (await run({ records: new Map([...tablet, ...phone]) })).app;
    expect(level1(synced)).toMatchObject({ isNew: false });
  });
});
