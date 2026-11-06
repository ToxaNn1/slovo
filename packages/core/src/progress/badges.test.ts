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
  catalogue = badges,
}: {
  records?: Map<string, string>;
  on?: string;
  off?: readonly FeatureSwitch[];
  catalogue?: readonly Badge[];
} = {}) {
  const events: unknown[][] = [];
  const port: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => ALL_ON.includes(feature) && !off.includes(feature),
      badges: catalogue,
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

  // Spec #1641, ticket #1644, ADR 0085: a flawless Game and a run of right answers.
  const flawless: Badge = {
    id: 'flawless',
    name: 'Flawless',
    symbol: '1',
    family: 'f',
    condition: { kind: 'flawlessGame', modes: ['correction', 'anglicism'] },
  };
  const rightRun: Badge = {
    id: 'run-3',
    name: 'Three in a row',
    symbol: '1',
    family: 'f',
    condition: { kind: 'rightRun', modes: ['stress'], count: 3 },
  };
  /** A Round answered at the minute `minute` of 14 October, right or wrong, in `mode`. */
  const answer = (minute: number, mode: string, right: boolean): XpRecord => {
    const time = new Date(Date.UTC(2026, 9, 14, 5, minute)).toISOString();
    return right
      ? { kind: 'xp', date: '2026-10-14', at: time, source: 'game-round', amount: 1, mode }
      : { kind: 'wrong-answer', date: '2026-10-14', at: time, mode };
  };
  const finished = (mode: string, right: number, played: number): XpRecord => ({
    kind: 'xp',
    date: '2026-10-14',
    at: at('2026-10-14'),
    source: 'game-finished',
    amount: 5,
    mode,
    right,
    played,
  });
  const earnedWith = async (catalogue: readonly Badge[], ...records: readonly XpRecord[]) =>
    earned((await run({ records: await readerWith(...records), catalogue })).app);

  it('earns flawlessGame with a Game right in every Round in a named mode only', async () => {
    expect(await earnedWith([flawless], finished('anglicism', 15, 15))).toEqual({
      flawless: '2026-10-14',
    });
    expect(await earnedWith([flawless], finished('anglicism', 14, 15))).toEqual({});
    expect(await earnedWith([flawless], finished('stress', 15, 15))).toEqual({});
    const { app } = await run({ records: await readerWith(), catalogue: [flawless] });
    expect(progressOf(app, 'flawless')).toMatchObject({ progress: { current: 0, target: 1 } });
  });

  it('earns rightRun at the Nth right answer in a row, not at N-1', async () => {
    const two = [answer(1, 'stress', true), answer(2, 'stress', true)];
    const { app } = await run({ records: await readerWith(...two), catalogue: [rightRun] });
    expect(earned(app)).toEqual({});
    expect(progressOf(app, 'run-3')).toMatchObject({ progress: { current: 2, target: 3 } });
    expect(await earnedWith([rightRun], ...two, answer(3, 'stress', true))).toEqual({
      'run-3': '2026-10-14',
    });
  });

  it('resets rightRun at a wrong answer, and answers in other modes neither add nor break it', async () => {
    const broken = await readerWith(
      answer(1, 'stress', true),
      answer(2, 'stress', true),
      answer(3, 'stress', false),
      answer(4, 'stress', true),
    );
    const { app } = await run({ records: broken, catalogue: [rightRun] });
    expect(earned(app)).toEqual({});
    expect(progressOf(app, 'run-3')).toMatchObject({ progress: { current: 1, target: 3 } });

    expect(
      await earnedWith(
        [rightRun],
        answer(1, 'stress', true),
        answer(2, 'correction', false),
        answer(3, 'correction', true),
        answer(4, 'correction', true),
        answer(5, 'stress', true),
      ),
    ).toEqual({});
    expect(
      await earnedWith(
        [rightRun],
        answer(1, 'stress', true),
        answer(2, 'correction', false),
        answer(3, 'stress', true),
        answer(4, 'anglicism', false),
        answer(5, 'stress', true),
      ),
    ).toEqual({ 'run-3': '2026-10-14' });
  });

  it('keeps a Badge earned under an old condition with its date after the Edition changes it', async () => {
    const records = await readerWith(
      answer(1, 'stress', true),
      answer(2, 'stress', true),
      answer(3, 'stress', true),
    );
    await run({ records, catalogue: [rightRun] });

    const harder: Badge = {
      ...rightRun,
      condition: { kind: 'rightRun', modes: ['stress'], count: 10 },
    };
    const { app } = await run({ records, on: '2026-10-30', catalogue: [harder] });
    expect(progressOf(app, 'run-3')).toMatchObject({ earned: true, date: '2026-10-14' });
  });
});
