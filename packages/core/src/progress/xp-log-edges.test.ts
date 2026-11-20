import { describe, expect, it } from 'vitest';

import { openComposition, type FeatureSwitch } from '../index';
import { createMemoryContentPort, seedUserState } from '../testing';
import { fakeClock, settle, testEdition, word } from '../test-support';
import { writeStaged } from '../user-state/staged-write';
import { createMemoryUserStatePort } from '../user-state/user-state';

// The XP log read off records kept out of order, at one instant, around reset markers.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

/** The XP log over the records at an instant, with every Feature Switch on unless one is listed off. */
async function open(
  stored: readonly (readonly [string, object])[] = [],
  { instant = '2026-10-14T08:00:00+03:00', off = [] as readonly FeatureSwitch[] } = {},
) {
  const records = new Map(stored.map(([id, record]) => [`xp.${id}`, JSON.stringify(record)]));
  const time = fakeClock(instant);
  const userState = await seedUserState({}, { port: createMemoryUserStatePort(records) });
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: (feature) => !off.includes(feature) }),
    userState,
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { xpLog: app.xpLog, records, time };
}

const at = (date: string, hour: number, minute = 0) =>
  `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const round = (date: string, instant: string, mode = 'definition') => ({
  kind: 'xp',
  date,
  at: instant,
  source: 'game-round',
  amount: 1,
  mode,
  rarity: 2,
});
const wrong = (date: string, instant: string, mode: string) => ({
  kind: 'wrong-answer',
  date,
  at: instant,
  mode,
});
const reset = (date: string, instant: string) => ({ kind: 'reset', date, at: instant });
const wordGoal = (date: string, instant: string, goal: number | null) => ({
  kind: 'word-goal',
  date,
  at: instant,
  goal,
});
const xpGoal = (date: string, instant: string, goal: number) => ({
  kind: 'daily-goal',
  date,
  at: instant,
  goal,
});
const finished = (mode: string, right: number, played: number) => ({
  kind: 'xp',
  date: '2026-10-13',
  at: at('2026-10-13', 9),
  source: 'game-finished',
  amount: 5,
  mode,
  right,
  played,
});

describe('the XP log read off its records', () => {
  it('orders the Game answers by instant, then by id at one instant, whatever order they are kept in', async () => {
    const { xpLog } = await open([
      ['b', wrong('2026-10-13', at('2026-10-13', 10), 'spelling')],
      ['a', round('2026-10-13', at('2026-10-13', 10))],
      ['c', wrong('2026-10-13', at('2026-10-13', 9), 'typed')],
    ]);

    expect(xpLog.milestones.answers).toEqual([
      { mode: 'typed', right: false },
      { mode: 'definition', right: true },
      { mode: 'spelling', right: false },
    ]);
  });

  it('picks the latest reset marker by instant, then by the greater id at one instant', async () => {
    const { xpLog } = await open([
      ['r-z', reset('2026-10-12', at('2026-10-12', 9))],
      ['r-m', reset('2026-10-13', at('2026-10-13', 9))],
      ['r-q', reset('2026-10-13', at('2026-10-13', 9))],
      ['r-a', reset('2026-10-13', at('2026-10-13', 9))],
      ['r-y', reset('2026-10-11', at('2026-10-11', 9))],
    ]);

    expect(xpLog.resetMarker).toEqual({ id: 'r-q', date: '2026-10-13', at: at('2026-10-13', 9) });
  });

  it('counts no record at the reset marker’s own instant, only the ones after it', async () => {
    const { xpLog } = await open([
      ['r', reset('2026-10-13', at('2026-10-13', 9))],
      ['x1', round('2026-10-13', at('2026-10-13', 9))],
      ['x2', round('2026-10-13', at('2026-10-13', 9, 1))],
    ]);

    expect(xpLog.state.total).toBe(1);
  });

  it('counts nothing for an award before the reset marker, after the clock moved back', async () => {
    const { xpLog } = await open([['r', reset('2026-10-14', at('2026-10-14', 6))]]);

    const award = xpLog.award({ source: 'game-round', mode: 'definition', rarity: 2 });
    award.commit();

    expect(award.amount).toBe(1);
    expect(xpLog.state.total).toBe(0);
  });

  it('keeps a Badge earned after a reset under an id of that reset', async () => {
    const { xpLog } = await open([['r-1', reset('2026-10-13', at('2026-10-13', 9))]]);

    expect([...xpLog.earn(['first-win']).changes.keys()]).toEqual(['xp.badge-first-win~r-1']);
  });

  it('reads the goal in Words of a day off the goals by date, then by instant, whatever else is kept', async () => {
    const { xpLog } = await open([
      ['g-7', wordGoal('2026-10-13', at('2026-10-13', 10), 7)],
      ['g-4', wordGoal('2026-10-13', at('2026-10-13', 9), 4)],
      ['g-3', wordGoal('2026-10-12', at('2026-10-13', 11), 3)],
      ['x', round('2026-10-13', at('2026-10-13', 12))],
    ]);

    expect(xpLog.dayOf('2026-10-13').dailyGoal?.goal).toBe(7);
    expect(xpLog.dayOf('2026-10-12').dailyGoal?.goal).toBe(3);
  });

  it('reads a past day under the last goal in XP set before it, by date, then by the first at one instant', async () => {
    const { xpLog } = await open([
      ['g1', xpGoal('2026-10-11', at('2026-10-11', 8), 3)],
      ['g3', xpGoal('2026-10-12', at('2026-10-12', 9), 8)],
      ['g4', xpGoal('2026-10-12', at('2026-10-12', 9), 9)],
      ['g2', xpGoal('2026-10-12', at('2026-10-12', 8), 6)],
      ['g0', xpGoal('2026-10-10', at('2026-10-12', 10), 1)],
      ['x1', round('2026-10-13', at('2026-10-13', 10))],
      ['x2', round('2026-10-13', at('2026-10-13', 11))],
      ['w', wrong('2026-10-13', at('2026-10-13', 12), 'spelling')],
    ]);

    expect(xpLog.dayOf('2026-10-13').dailyGoal).toEqual({ goal: 8, met: false });
  });

  it('counts a Game flawless only with every one of its answers right, and none for a Game of no answers', async () => {
    const { xpLog } = await open([
      ['f0', finished('definition', 0, 0)],
      ['f1', finished('spelling', 4, 5)],
      ['f2', finished('typed', 3, 3)],
    ]);

    expect([...xpLog.milestones.wins].sort()).toEqual(['definition', 'spelling', 'typed']);
    expect([...xpLog.milestones.flawless]).toEqual(['typed']);
  });

  it('reads no solve for a date with no Daily Crossword solved', async () => {
    const { xpLog } = await open();

    expect(xpLog.crosswordSolveOn('2026-10-14')).toBeUndefined();
  });

  it('finds the date a total was reached in the order of the instants, counting XP records alone', async () => {
    const { xpLog } = await open([
      ['x2', round('2026-10-13', at('2026-10-13', 9))],
      ['x1', round('2026-10-12', at('2026-10-12', 9))],
      ['w', wrong('2026-10-11', at('2026-10-11', 9), 'spelling')],
    ]);

    expect(xpLog.reachedOn(1)).toBe('2026-10-12');
    expect(xpLog.reachedOn(2)).toBe('2026-10-13');
    expect(xpLog.reachedOn(3)).toBeUndefined();
  });

  it('finds the date a total was reached counting only the XP after the reset marker', async () => {
    const { xpLog } = await open([
      ['x1', round('2026-10-12', at('2026-10-12', 9))],
      ['r', reset('2026-10-12', at('2026-10-12', 12))],
      ['x2', round('2026-10-13', at('2026-10-13', 9))],
    ]);

    expect(xpLog.reachedOn(1)).toBe('2026-10-13');
  });
});

describe('the XP log’s awards and appends', () => {
  it('earns the finished-Game XP for a Game exactly at the Edition’s share of right answers', async () => {
    const { xpLog } = await open();

    expect(
      xpLog.award({ source: 'game-finished', mode: 'definition', right: 2, played: 4 }).amount,
    ).toBe(5);
  });

  it('earns a Review answer once a day for each Entry, and a Daily Crossword once a date', async () => {
    const { xpLog } = await open();
    xpLog.award({ source: 'review-answer', entryId: 'w_01' }).commit();
    xpLog.award({ source: 'daily-crossword', date: '2026-10-14', solveSeconds: 40 }).commit();

    expect(xpLog.award({ source: 'review-answer', entryId: 'w_01' }).amount).toBe(0);
    expect(xpLog.award({ source: 'review-answer', entryId: 'w_02' }).amount).toBe(1);
    expect(xpLog.award({ source: 'daily-crossword', date: '2026-10-14' }).amount).toBe(0);
    expect(xpLog.award({ source: 'daily-crossword', date: '2026-10-13' }).amount).toBe(15);
  });

  describe('two awards staged before either is committed', () => {
    const reviewed = (entryId: string, minute: number) =>
      [
        `review-answer-2026-10-14-${entryId}`,
        {
          kind: 'xp',
          date: '2026-10-14',
          at: at('2026-10-14', 4, minute),
          source: 'review-answer',
          amount: 1,
          entryId,
        },
      ] as const;

    const xpKeys = (records: Map<string, string>) =>
      [...records.keys()].filter((key) => key.startsWith('xp.'));

    it('keeps both Rounds answered right, each its own record, in one write', async () => {
      const { xpLog, records } = await open();

      const first = xpLog.award({ source: 'game-round', mode: 'definition', rarity: 2 });
      const second = xpLog.award({ source: 'game-round', mode: 'definition', rarity: 3 });
      expect(xpLog.state.total).toBe(0);
      await writeStaged(createMemoryUserStatePort(records), [first, second]);

      expect([first.amount, second.amount]).toEqual([1, 1]);
      expect(xpKeys(records)).toHaveLength(2);
      expect(xpLog.state).toMatchObject({ total: 2, today: 2 });
      expect(xpLog.milestones.rightRarities).toEqual(new Set([2, 3]));
    });

    it('keeps both when each is written and committed on its own, the first after the second was staged', async () => {
      const { xpLog, records } = await open();
      const userState = createMemoryUserStatePort(records);

      const first = xpLog.award({ source: 'game-round', mode: 'definition', rarity: 2 });
      const second = xpLog.award({ source: 'quick-question' });
      await writeStaged(userState, [first]);
      await writeStaged(userState, [second]);

      expect(xpKeys(records)).toHaveLength(2);
      expect(xpLog.state).toMatchObject({ total: 3, today: 3 });
    });

    it('counts one Review answer of an Entry staged twice once', async () => {
      const { xpLog, records } = await open();

      const first = xpLog.award({ source: 'review-answer', entryId: 'w_01' });
      const second = xpLog.award({ source: 'review-answer', entryId: 'w_01' });
      await writeStaged(createMemoryUserStatePort(records), [first, second]);

      expect(xpKeys(records)).toEqual(['xp.review-answer-2026-10-14-w_01']);
      expect(xpLog.state).toMatchObject({ total: 1, today: 1 });
      expect(xpLog.award({ source: 'review-answer', entryId: 'w_01' }).amount).toBe(0);
    });

    it('never counts Review answers past the daily cap, though each saw room under it', async () => {
      const { xpLog, records } = await open(
        Array.from({ length: 9 }, (_, index) => reviewed(`w_0${String(index)}`, index)),
      );
      expect(xpLog.state.today).toBe(9);

      const first = xpLog.award({ source: 'review-answer', entryId: 'w_10' });
      const second = xpLog.award({ source: 'review-answer', entryId: 'w_11' });
      await writeStaged(createMemoryUserStatePort(records), [first, second]);

      expect(xpLog.state).toMatchObject({ total: 10, today: 10 });
      expect(xpLog.award({ source: 'review-answer', entryId: 'w_12' }).amount).toBe(0);
    });
  });

  it('earns nothing and writes nothing with the xpLog switch off', async () => {
    const { xpLog } = await open([], { off: ['xpLog'] });

    const award = xpLog.award({ source: 'game-round', mode: 'definition', rarity: 2 });

    expect(award.amount).toBe(0);
    expect(award.changes.size).toBe(0);
  });

  it('tells its listeners of a freeze, an opened Badge and a Break, and of no empty freeze', async () => {
    const { xpLog } = await open();
    const told: string[] = [];
    xpLog.subscribe((change) => told.push(change));

    xpLog.freeze([]).commit();
    expect(told).toEqual([]);

    xpLog.freeze(['2026-10-12']).commit();
    xpLog.open('first-win').commit();
    xpLog.open('streak-7').commit();
    xpLog.startBreak(2).commit();

    expect(told).toEqual(['other', 'other', 'other', 'other']);
    expect([...xpLog.days.frozen]).toEqual(['2026-10-12']);
    expect([...xpLog.milestones.opened].sort()).toEqual(['first-win', 'streak-7']);
    expect(xpLog.days.breaks.get('2026-10-14')).toBe(2);
  });

  it('celebrates no goal met by a day the clock moved into', async () => {
    const { xpLog, time } = await open([
      ['g', wordGoal('2026-10-14', at('2026-10-14', 4), 1)],
      ['goal-met-2026-10-15', { kind: 'goal-met', date: '2026-10-15', at: at('2026-10-14', 4) }],
    ]);
    let celebrated = 0;
    xpLog.subscribeGoalMet(() => (celebrated += 1));
    expect(xpLog.state.dailyGoal?.met).toBe(false);

    time.set('2026-10-15T08:00:00+03:00');
    xpLog.award({ source: 'game-round', mode: 'definition', rarity: 2 }).commit();

    expect(xpLog.state.dailyGoal?.met).toBe(true);
    expect(celebrated).toBe(0);
  });

  it('writes the goal in force today again with a reset, and tells its listeners of the reset', async () => {
    const { xpLog, records } = await open([
      ['g-5', wordGoal('2026-10-12', at('2026-10-12', 8), 5)],
      ['g-7', wordGoal('2026-10-14', at('2026-10-14', 4), 7)],
      ['g-9', wordGoal('2026-10-20', at('2026-10-14', 4, 30), 9)],
    ]);
    const told: string[] = [];
    xpLog.subscribe((change) => told.push(change));

    await xpLog.reset();
    await settle();

    const now = '2026-10-14T05:00:00.000Z';
    const written = [...records.values()]
      .map((value): unknown => JSON.parse(value))
      .filter(
        (record) =>
          typeof record === 'object' && record !== null && 'at' in record && record.at === now,
      );
    expect(written).toEqual([
      { kind: 'reset', date: '2026-10-14', at: now },
      { kind: 'word-goal', date: '2026-10-14', at: now, goal: 7 },
    ]);
    expect(told).toEqual(['progress-reset']);
  });
});
