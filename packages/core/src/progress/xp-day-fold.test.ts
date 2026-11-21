import { describe, expect, it } from 'vitest';

import { openComposition } from '../index';
import { createMemoryContentPort, seedUserState } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort } from '../user-state/user-state';

// ADR 0205: the records of a local date older than 30 days fold into XP days, and nothing the log derives changes.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

const edition = testEdition({ isFeatureEnabled: () => true });

/** The Core composition over the records at an instant, as a launch opens it. */
async function open(records: Map<string, string>, instant: string) {
  const time = fakeClock(instant);
  const userState = await seedUserState({}, { port: createMemoryUserStatePort(records) });
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { xpLog: app.xpLog, dataExport: app.dataExport };
}

const at = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;

const review = (date: string, hour: number, amount: number) =>
  `{"kind":"xp","date":"${date}","at":"${at(date, hour)}","source":"review-answer","amount":${String(amount)}}`;

const round = (date: string, hour: number, mode: string, rarity: number) =>
  `{"kind":"xp","date":"${date}","at":"${at(date, hour)}","source":"game-round","amount":1,"mode":"${mode}","rarity":${String(rarity)}}`;

/** A log of two old days and one recent, of every kind the Badges and the Streak read. */
const stored = () =>
  new Map([
    ['xp.review-a', review('2026-09-01', 9, 6)],
    ['xp.review-b', review('2026-09-01', 10, 6)],
    ['xp.round-a', round('2026-09-01', 11, 'definition', 4)],
    [
      'xp.wrong-a',
      `{"kind":"wrong-answer","date":"2026-09-01","at":"${at('2026-09-01', 12)}","mode":"definition"}`,
    ],
    ['xp.round-b', round('2026-09-01', 13, 'definition', 2)],
    [
      'xp.finished-a',
      `{"kind":"xp","date":"2026-09-01","at":"${at('2026-09-01', 14)}","source":"game-finished","amount":5,"mode":"definition","right":2,"played":3}`,
    ],
    [
      'xp.daily-crossword-2026-09-02',
      `{"kind":"xp","date":"2026-09-02","at":"${at('2026-09-02', 9)}","source":"daily-crossword","amount":15,"solveSeconds":83,"hinted":true}`,
    ],
    ['xp.freeze-2026-09-03', `{"kind":"freeze","date":"2026-09-03","at":"${at('2026-09-04', 8)}"}`],
    [
      'xp.badge-first-game',
      `{"kind":"badge","date":"2026-09-01","at":"${at('2026-09-01', 15)}","badge":"first-game"}`,
    ],
    ['xp.round-recent', round('2026-10-10', 9, 'spelling', 5)],
  ]);

const DATES = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-10', '2026-10-14'];

/** All the XP log gives a reader. */
function readOf(xpLog: Awaited<ReturnType<typeof open>>['xpLog']) {
  const { byDate, active, frozen, breaks } = xpLog.days;
  const { wins, rightByMode, flawless, answers, rightRarities, crosswords, badges, opened } =
    xpLog.milestones;
  return {
    state: xpLog.state,
    days: {
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
    crossword: xpLog.crosswordSolveOn('2026-09-02'),
    reached: xpLog.reachedOn(20),
  };
}

const keysOf = (records: Map<string, string>, prefix: string) =>
  [...records.keys()].filter((key) => key.startsWith(prefix)).sort();

describe('the XP log of days older than 30 days', () => {
  it('folds each such day into one XP day and deletes its records, the rest staying records', async () => {
    const records = stored();

    // 2026-10-03 is 30 days after 2026-09-03, so only the first two days are older.
    await open(records, '2026-10-03T12:00:00+03:00');

    expect(keysOf(records, 'xp.')).toEqual(['xp.freeze-2026-09-03', 'xp.round-recent']);
    const days = keysOf(records, 'xpDay.');
    expect(days).toHaveLength(2);
    expect(days[0]).toMatch(/^xpDay\.2026-09-01-/);
    expect(days[1]).toMatch(/^xpDay\.2026-09-02-/);
  });

  it('derives the same from the folded log as from its records, at the fold and on the next launch', async () => {
    // Before any day is old enough to fold.
    const asRecords = readOf((await open(stored(), '2026-09-20T12:00:00+03:00')).xpLog);
    const records = stored();

    const folding = await open(records, '2026-10-14T12:00:00+03:00');
    const folded = await open(records, '2026-10-14T12:00:00+03:00');

    expect(keysOf(records, 'xp.')).toEqual(['xp.round-recent']);
    expect(asRecords.state.total).toBe(33);
    expect(readOf(folding.xpLog)).toEqual(asRecords);
    expect(readOf(folded.xpLog)).toEqual(asRecords);
  });

  it('counts a record that arrives late for a folded day once, and folds it at the next launch', async () => {
    const records = stored();
    await open(records, '2026-10-14T12:00:00+03:00');
    // Another device's record of a folded day, as a pull writes it.
    records.set('xp.round-late', round('2026-09-01', 16, 'definition', 3));

    const { xpLog } = await open(records, '2026-10-14T12:00:00+03:00');

    expect(xpLog.state.total).toBe(34);
    expect(xpLog.dayOf('2026-09-01').xp).toBe(18);
    expect(keysOf(records, 'xp.')).toEqual(['xp.round-recent']);
    expect(keysOf(records, 'xpDay.')).toHaveLength(4);
    expect((await open(records, '2026-10-14T12:00:00+03:00')).xpLog.state.total).toBe(34);
  });

  it('counts a record kept beside the XP day that holds it once, and deletes it', async () => {
    const records = stored();
    await open(records, '2026-10-14T12:00:00+03:00');
    const days = keysOf(records, 'xpDay.');
    // A device that never heard of the fold still has the record, and a pull brings the XP day.
    records.set('xp.round-a', round('2026-09-01', 11, 'definition', 4));

    const { xpLog } = await open(records, '2026-10-14T12:00:00+03:00');

    expect(xpLog.state.total).toBe(33);
    expect(xpLog.milestones.rightByMode.get('definition')).toBe(2);
    expect(keysOf(records, 'xp.')).toEqual(['xp.round-recent']);
    expect(keysOf(records, 'xpDay.')).toEqual(days);
  });

  it('makes the same XP days on two devices that fold the same records', async () => {
    const one = stored();
    const other = new Map([...stored()].reverse());

    await open(one, '2026-10-14T12:00:00+03:00');
    await open(other, '2026-10-20T07:00:00+03:00');

    expect(keysOf(other, 'xpDay.')).toEqual(keysOf(one, 'xpDay.'));
    for (const key of keysOf(one, 'xpDay.')) expect(other.get(key)).toBe(one.get(key));
  });

  it('splits a day too large for one record of Sync into XP days of at most 8 KB', async () => {
    const records = new Map<string, string>();
    for (let index = 0; index < 400; index += 1) {
      records.set(`xp.round-${String(index).padStart(3, '0')}`, round('2026-09-01', 9, 'слово', 3));
    }

    const { xpLog } = await open(records, '2026-10-14T12:00:00+03:00');

    expect(keysOf(records, 'xp.')).toEqual([]);
    const days = keysOf(records, 'xpDay.');
    expect(days.length).toBeGreaterThan(1);
    expect(days.length).toBeLessThan(8);
    for (const key of days) {
      // Each escape of `encodeURIComponent` is one byte of UTF-8.
      const bytes = encodeURIComponent(records.get(key) ?? '').replace(/%[0-9A-F]{2}/g, 'x').length;
      expect(bytes).toBeLessThanOrEqual(8 * 1024);
    }
    expect(xpLog.state.total).toBe(400);
    expect((await open(records, '2026-10-14T12:00:00+03:00')).xpLog.state.total).toBe(400);
  });

  it('keeps an instant written another way as it was', async () => {
    const records = new Map([
      [
        'xp.round-a',
        '{"kind":"xp","date":"2026-09-01","at":"2026-09-01T09:00:00Z","source":"game-round","amount":1}',
      ],
    ]);

    await open(records, '2026-10-14T12:00:00+03:00');
    const exported = await (await open(records, '2026-10-14T12:00:00+03:00')).dataExport();

    expect(exported.progress.xpLog).toEqual([
      {
        id: 'round-a',
        kind: 'xp',
        date: '2026-09-01',
        at: '2026-09-01T09:00:00Z',
        source: 'game-round',
        amount: 1,
      },
    ]);
  });

  it('skips a row whose instant is no instant, and still opens with the other rows of the day', async () => {
    const records = new Map([
      [
        'xpDay.2026-09-01-2-broken',
        '{"date":"2026-09-01","rows":{"round-a":{"t":1e20,"source":"game-round","amount":1,"mode":"definition","rarity":4},"review-a":{"t":32400000,"source":"review-answer","amount":6}}}',
      ],
    ]);

    const { xpLog } = await open(records, '2026-10-14T09:00:00.000Z');

    expect(xpLog.state.total).toBe(6);
  });

  it('lists the folded records in the Data export as it lists records', async () => {
    const asRecords = await (await open(stored(), '2026-09-20T12:00:00+03:00')).dataExport();
    const records = stored();

    await open(records, '2026-10-14T12:00:00+03:00');
    const folded = await (await open(records, '2026-10-14T12:00:00+03:00')).dataExport();

    const byId = (log: typeof folded.progress.xpLog) =>
      [...log].sort((one, other) => one.id.localeCompare(other.id));
    expect(byId(folded.progress.xpLog)).toEqual(byId(asRecords.progress.xpLog));
    expect(folded.progress.xpLog).toHaveLength(10);
  });
});
