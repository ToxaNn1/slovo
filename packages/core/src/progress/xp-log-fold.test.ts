import { describe, expect, it } from 'vitest';

import { openComposition } from '../index';
import { createMemoryContentPort, seedUserState } from '../testing';
import { fakeClock, settle, testEdition, word } from '../test-support';
import { createMemoryUserStatePort } from '../user-state/user-state';

// Review 13.11, R54 and R55: the XP log counts an appended record alone and reads a day from its own records.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

const base = testEdition();

/** The Core composition over the records at an instant, and how many times the log read the Review XP's daily cap. */
async function open(records: Map<string, string>, instant: string) {
  const time = fakeClock(instant);
  let capReads = 0;
  const xp = {
    ...base.xp,
    get reviewDailyCap() {
      capReads += 1;
      return base.xp.reviewDailyCap;
    },
  };
  const userState = await seedUserState({}, { port: createMemoryUserStatePort(records) });
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: () => true, xp }),
    userState,
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { xpLog: app.xpLog, userState, time, capReads: () => capReads };
}

const review = (date: string, hour: number, amount: number) =>
  `{"kind":"xp","date":"${date}","at":"${date}T${String(hour).padStart(2, '0')}:00:00.000Z","source":"review-answer","amount":${String(amount)}}`;

/** A log of earlier days, kept out of the order of its instants. */
const stored = () =>
  new Map([
    ['xp.review-c', review('2026-10-12', 12, 6)],
    ['xp.review-a', review('2026-10-12', 9, 6)],
    ['xp.review-b', review('2026-10-12', 10, 6)],
    ['xp.review-d', review('2026-10-13', 9, 3)],
    [
      'xp.round-late',
      '{"kind":"xp","date":"2026-10-13","at":"2026-10-13T15:00:00.000Z","source":"game-round","amount":1,"mode":"definition","rarity":4}',
    ],
    [
      'xp.wrong-early',
      '{"kind":"wrong-answer","date":"2026-10-13","at":"2026-10-13T08:00:00.000Z","mode":"spelling"}',
    ],
    [
      'xp.old-goal',
      '{"kind":"daily-goal","date":"2026-10-11","at":"2026-10-11T08:00:00.000Z","goal":5}',
    ],
  ]);

const DATES = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];

/** All the XP log gives a reader. */
function readOf(xpLog: Awaited<ReturnType<typeof open>>['xpLog']) {
  const { date, byDate, active, frozen, breaks } = xpLog.days;
  const { wins, rightByMode, flawless, answers, rightRarities, crosswords, badges, opened } =
    xpLog.milestones;
  return {
    state: xpLog.state,
    days: {
      date,
      byDate: [...byDate].sort(),
      active: [...active].sort(),
      frozen: [...frozen].sort(),
      breaks: [...breaks].sort(),
    },
    milestones: {
      wins: [...wins].sort(),
      rightByMode: [...rightByMode].sort(),
      flawless: [...flawless].sort(),
      answers,
      rightRarities: [...rightRarities].sort(),
      crosswords: [...crosswords].sort(),
      badges: [...badges].sort(),
      opened: [...opened].sort(),
    },
    daysOf: DATES.map((day) => xpLog.dayOf(day)),
  };
}

describe('the XP log as records are appended', () => {
  it('counts the appended record alone, not the records kept before', async () => {
    const { xpLog, userState, capReads } = await open(stored(), '2026-10-14T08:00:00+03:00');
    expect(xpLog.state.total).toBe(14);
    const before = capReads();

    const award = xpLog.award({ source: 'game-round', mode: 'definition', rarity: 3 });
    await userState.write(award.changes);
    award.commit();

    expect(xpLog.state.total).toBe(15);
    expect(xpLog.state.today).toBe(1);
    expect(capReads() - before).toBe(0);
  });

  it('reads the same after appends as the same records opened anew', async () => {
    const records = stored();
    const { xpLog, userState, time } = await open(records, '2026-10-14T08:00:00+03:00');
    const append = async (added: {
      changes: Parameters<typeof userState.write>[0];
      commit(): void;
    }) => {
      await userState.write(added.changes);
      added.commit();
    };

    await xpLog.setDailyGoal(10);
    await append(xpLog.award({ source: 'game-round', mode: 'definition', rarity: 2 }));
    await append(xpLog.answeredWrong('definition'));
    time.advance(60_000);
    await append(xpLog.award({ source: 'game-finished', mode: 'definition', right: 5, played: 5 }));
    for (const entryId of ['w_01', 'w_02', 'w_03'])
      await append(xpLog.award({ source: 'review-answer', entryId }));
    await append(xpLog.award({ source: 'daily-crossword', date: '2026-10-14', solveSeconds: 61 }));
    await append(xpLog.earn(['first-win']));
    await append(xpLog.open('first-win'));
    await append(xpLog.freeze(['2026-10-10']));
    await append(xpLog.startBreak(3));
    // The same day's Break again: its record replaces the one before.
    await append(xpLog.startBreak(2));
    // An answer whose instant is before the answers already kept.
    time.set('2026-10-14T04:00:00.000Z');
    await append(xpLog.answeredWrong('spelling'));
    await append(xpLog.award({ source: 'game-round', mode: 'spelling', rarity: 5 }));
    await xpLog.setDailyGoal(null);
    await append(xpLog.award({ source: 'quick-question' }));
    await settle();

    const anew = await open(new Map(records), '2026-10-14T04:00:00.000Z');
    expect(readOf(xpLog)).toEqual(readOf(anew.xpLog));
    expect(xpLog.milestones.answers.length).toBe(6);
    expect(xpLog.days.breaks.get('2026-10-14')).toBe(2);
  });
});
