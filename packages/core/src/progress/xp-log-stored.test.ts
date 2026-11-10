import { describe, expect, it } from 'vitest';

import { openComposition } from '../index';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  seedUserState,
} from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort } from '../user-state/user-state';

// Spec #1778, ticket #1788: an XP log entry holds only the fields of its own source.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

/** The Core composition over the stored records, on the local day 2026-10-14. */
async function open(stored: Record<string, string>) {
  const records = new Map(Object.entries(stored));
  const time = fakeClock('2026-10-14T08:00:00+03:00');
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: () => true,
      userSettingDefaults: {
        notificationTimes: ['09:00', '13:00', '19:00'],
        mix: { categoryIds: ['test'] },
      },
    }),
    userState: await seedUserState({}, { port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: { next: () => 0.25 },
    scheduling: {
      scheduler: createFakeNotificationScheduler(),
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Farewell',
      streakWarning: 'Streak warning',
      goalNotMet: 'Goal not met',
    },
  });
  return { xpLog: app.xpLog, records };
}

const at = '2026-10-12T10:00:00.000Z';
const entry = (fields: string) => `{"kind":"xp","date":"2026-10-12","at":"${at}",${fields}}`;

/** Entries kept before the Badges fields, and after them. */
const stored = {
  'xp.round-before': entry('"source":"game-round","amount":2'),
  'xp.finished-before': entry('"source":"game-finished","amount":10'),
  'xp.daily-crossword-2026-10-11': entry('"source":"daily-crossword","amount":20').replace(
    '2026-10-12"',
    '2026-10-11"',
  ),
  'xp.round': entry('"source":"game-round","amount":2,"mode":"definition","rarity":4'),
  'xp.finished': entry(
    '"source":"game-finished","amount":10,"mode":"definition","right":5,"played":5',
  ),
  'xp.half': entry('"source":"game-finished","amount":10,"mode":"spelling","right":3,"played":6'),
  'xp.daily-crossword-2026-10-12': entry(
    '"source":"daily-crossword","amount":20,"solveSeconds":95,"hinted":true',
  ),
  'xp.best': entry('"source":"game-best","amount":5'),
  'xp.quick': entry('"source":"quick-question","amount":3'),
  'xp.wrong': `{"kind":"wrong-answer","date":"2026-10-12","at":"2026-10-12T10:01:00.000Z","mode":"spelling"}`,
};

describe('the XP log entries kept in the user state', () => {
  it('reads the entries kept before the Badges fields and after them', async () => {
    const { xpLog } = await open(stored);

    expect(xpLog.state.total).toBe(82);
    expect(xpLog.days.byDate).toEqual(
      new Map([
        ['2026-10-11', 20],
        ['2026-10-12', 62],
      ]),
    );
    expect(xpLog.milestones.wins).toEqual(new Set(['definition', 'spelling']));
    expect(xpLog.milestones.flawless).toEqual(new Set(['definition']));
    expect(xpLog.milestones.rightByMode).toEqual(new Map([['definition', 1]]));
    expect(xpLog.milestones.rightRarities).toEqual(new Set([4]));
    expect(xpLog.milestones.crosswords).toEqual(new Set(['2026-10-11', '2026-10-12']));
    expect(xpLog.crosswordSolveOn('2026-10-11')).toEqual({
      solveSeconds: undefined,
      hinted: false,
    });
    expect(xpLog.crosswordSolveOn('2026-10-12')).toEqual({ solveSeconds: 95, hinted: true });
  });

  it('ignores the fields foreign to an entry’s source', async () => {
    const { xpLog } = await open({
      'xp.quick': entry(
        '"source":"quick-question","amount":3,"mode":"definition","right":1,"played":1',
      ),
      'xp.round': entry('"source":"game-round","amount":2,"solveSeconds":4,"right":1,"played":1'),
      'xp.daily-crossword-2026-10-12': entry(
        '"source":"daily-crossword","amount":20,"mode":"definition","rarity":4',
      ),
    });

    expect(xpLog.state.total).toBe(25);
    expect(xpLog.milestones.wins).toEqual(new Set());
    expect(xpLog.milestones.flawless).toEqual(new Set());
    expect(xpLog.milestones.rightByMode).toEqual(new Map());
    expect(xpLog.milestones.rightRarities).toEqual(new Set());
    expect(xpLog.crosswordSolveOn('2026-10-12')).toEqual({
      solveSeconds: undefined,
      hinted: false,
    });
  });

  it('keeps the entries kept before, and writes a new entry in the bytes it had before', async () => {
    const { xpLog, records } = await open(stored);
    const written = (changes: ReadonlyMap<string, string | undefined>) => [...changes.values()];
    const today = (fields: string) =>
      `{"kind":"xp","date":"2026-10-14","at":"2026-10-14T05:00:00.000Z",${fields}}`;

    expect(
      written(xpLog.award({ source: 'game-round', mode: 'definition', rarity: 3 }).changes),
    ).toEqual([today('"source":"game-round","amount":1,"mode":"definition","rarity":3')]);
    expect(
      written(xpLog.award({ source: 'game-round', mode: 'definition', rarity: undefined }).changes),
    ).toEqual([today('"source":"game-round","amount":1,"mode":"definition"')]);
    expect(
      written(
        xpLog.award({ source: 'game-finished', mode: 'spelling', right: 4, played: 5 }).changes,
      ),
    ).toEqual([
      today('"source":"game-finished","amount":5,"mode":"spelling","right":4,"played":5'),
    ]);
    expect(
      written(
        xpLog.award({
          source: 'daily-crossword',
          date: '2026-10-14',
          solveSeconds: 61,
          hinted: false,
        }).changes,
      ),
    ).toEqual([today('"source":"daily-crossword","amount":15,"solveSeconds":61,"hinted":false')]);
    expect(written(xpLog.award({ source: 'daily-crossword', date: '2026-10-14' }).changes)).toEqual(
      [today('"source":"daily-crossword","amount":15')],
    );
    expect(written(xpLog.award({ source: 'game-best' }).changes)).toEqual([
      today('"source":"game-best","amount":5'),
    ]);
    expect(written(xpLog.award({ source: 'review-answer', entryId: 'w_01' }).changes)).toEqual([
      today('"source":"review-answer","amount":1'),
    ]);
    expect(written(xpLog.award({ source: 'quick-question' }).changes)).toEqual([
      today('"source":"quick-question","amount":2'),
    ]);
    expect(Object.fromEntries([...records].filter(([key]) => key.startsWith('xp.')))).toMatchObject(
      stored,
    );
  });
});
