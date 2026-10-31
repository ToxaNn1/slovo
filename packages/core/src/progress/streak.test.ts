import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type AnalyticsPort,
  type Composition,
  type FeatureSwitch,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, settle, testEdition, word } from '../test-support';

// Spec #1358 stories 25-28 and 85, ticket #1370, ADR 0066: the Active Day at
// 5 XP, the Streak and Best Streak derived by local date, and Streak freezes.

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

const ALL_ON: readonly FeatureSwitch[] = ['xpLog', 'streakFreezes', 'analytics'];

/** One app run over the records, opened at nine in the morning in Kyiv on the date. */
async function run({
  records,
  on = ALL_ON,
  time = fakeClock('2026-10-14T09:00:00+03:00'),
}: {
  records: Map<string, string>;
  on?: readonly FeatureSwitch[];
  time?: ReturnType<typeof fakeClock>;
}) {
  const events: unknown[][] = [];
  const analytics: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(3),
    analytics,
  });
  await settle();
  return { app, events, time };
}

const openOn = (records: Map<string, string>, date: string, on?: readonly FeatureSwitch[]) =>
  run({ records, time: fakeClock(`${date}T09:00:00+03:00`), ...(on === undefined ? {} : { on }) });

/** The XP log records of `amount` XP from a Game Round on each local date. */
function earned(records: Map<string, string>, amount: number, ...dates: string[]) {
  for (const date of dates) {
    records.set(
      `xp.seed-${date}`,
      JSON.stringify({
        kind: 'xp',
        date,
        at: `${date}T09:00:00.000Z`,
        source: 'game-round',
        amount,
      }),
    );
  }
  return records;
}

/** The local dates from `first` to `last`, both in, in October 2026. */
const october = (first: number, last: number) =>
  Array.from(
    { length: last - first + 1 },
    (_, index) => `2026-10-${String(first + index).padStart(2, '0')}`,
  );

/** Earns XP by answering Game Rounds right, 1 XP each, written as the Game writes them. */
async function earnRounds(app: Composition, rounds: number, records: Map<string, string>) {
  for (let round = 0; round < rounds; round += 1) {
    const award = app.xpLog.award({ source: 'game-round' });
    for (const [key, value] of award.changes) if (value !== undefined) records.set(key, value);
    award.commit();
  }
  await settle();
}

/** The local dates the freeze-consumed records of the XP log cover. */
const frozenDays = (records: ReadonlyMap<string, string>) =>
  [...records]
    .filter(([key]) => key.startsWith('xp.'))
    .map(([, value]) => JSON.parse(value) as { kind: string; date: string })
    .filter(({ kind }) => kind === 'freeze')
    .map(({ date }) => date)
    .sort();

describe('the Active Day', () => {
  it('needs exactly 5 XP on a local date: 4 make none, the 5th makes it', async () => {
    const records = new Map<string, string>();
    const { app } = await run({ records });
    expect(app.progress.state.streak).toBe(0);

    await earnRounds(app, 4, records);
    expect(app.progress.state.streak).toBe(0);

    await earnRounds(app, 1, records);
    expect(app.progress.state).toMatchObject({ streak: 1, bestStreak: 1 });
  });

  it('counts the XP of each side of midnight on its own local date', async () => {
    const records = new Map<string, string>();
    const time = fakeClock('2026-10-14T23:58:00+03:00');
    const { app } = await run({ records, time });
    await earnRounds(app, 4, records);

    time.set('2026-10-15T00:01:00+03:00');
    await app.resume();
    await earnRounds(app, 4, records);
    expect(app.progress.state.streak).toBe(0);

    await earnRounds(app, 1, records);
    expect(app.progress.state).toMatchObject({ streak: 1, bestStreak: 1 });
  });

  it('keeps the local date of the time zone the XP was earned in', async () => {
    const records = new Map<string, string>();
    // 01:00 on 2026-10-15 in Kyiv is still 18:00 on 2026-10-14 in New York.
    const time = fakeClock('2026-10-15T01:00:00+03:00', 'America/New_York');
    const { app } = await run({ records, time });
    await earnRounds(app, 5, records);

    expect(app.progress.state.streak).toBe(1);
    const xp = [...records].filter(([key]) => key.startsWith('xp.'));
    expect(xp.map(([, value]) => (JSON.parse(value) as { date: string }).date)).toEqual(
      Array.from({ length: 5 }, () => '2026-10-14'),
    );
  });

  it('keeps the Active Days recorded before 1.0, and opening the app records none', async () => {
    const records = new Map([
      ['activeDays.2026-10-12', 'true'],
      ['activeDays.2026-10-13', 'true'],
    ]);
    const { app } = await run({ records });
    expect(app.progress.state.streak).toBe(2);
    expect(records.has('activeDays.2026-10-14')).toBe(false);

    await earnRounds(app, 5, records);
    expect(app.progress.state).toMatchObject({ streak: 3, bestStreak: 3 });
  });

  it('fires a celebration on a Streak day of 1 to 7, 14, 30, 50, 100, 200 and 365', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(1, 13));
    const { app } = await run({ records });
    const celebrated: number[] = [];
    app.progress.onStreakMilestone((streak) => celebrated.push(streak));

    await earnRounds(app, 5, records);
    expect(celebrated).toEqual([14]);

    // The 8th Streak day is no celebration.
    const next = await run({ records: earned(new Map(), 5, ...october(6, 12)) });
    const none: number[] = [];
    next.app.progress.onStreakMilestone((streak) => none.push(streak));
    await earnRounds(next.app, 5, new Map());
    expect(none).toEqual([]);
  });
});

describe('the Streak and its freezes', () => {
  it('starts a new reader with 2 freezes', async () => {
    const { app } = await run({ records: new Map() });

    expect(app.progress.state).toMatchObject({ streak: 0, bestStreak: 0, freezesHeld: 2 });
  });

  it('covers a missed day with a held freeze, appends its record and emits «freeze used»', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 12));
    const { app, events } = await openOn(records, '2026-10-14');

    expect(app.progress.state).toMatchObject({ streak: 3, bestStreak: 3, freezesHeld: 1 });
    expect(frozenDays(records)).toEqual(['2026-10-13']);
    expect(events).toEqual([['freezeUsed', { freezesHeld: 1 }]]);

    // Today's 5 XP adds to the Streak the freeze kept.
    const today = await openOn(records, '2026-10-14');
    await earnRounds(today.app, 5, records);
    expect(today.app.progress.state).toMatchObject({ streak: 4, freezesHeld: 1 });
    expect(today.events).toEqual([]);
  });

  it('covers two missed days with the 2 freezes of the start', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 11));
    const { app } = await openOn(records, '2026-10-14');

    expect(app.progress.state).toMatchObject({ streak: 2, freezesHeld: 0 });
    expect(frozenDays(records)).toEqual(['2026-10-12', '2026-10-13']);
  });

  it('adds a freeze for every 7 Streak days and holds at most 2', async () => {
    // A freeze covers 2026-10-04; the 7th Streak day, 2026-10-08, gives it back.
    const records = earned(new Map<string, string>(), 5, ...october(1, 3));
    await openOn(records, '2026-10-05');
    expect(frozenDays(records)).toEqual(['2026-10-04']);
    earned(records, 5, ...october(5, 8));
    expect((await openOn(records, '2026-10-09')).app.progress.state).toMatchObject({
      streak: 7,
      freezesHeld: 2,
    });

    // The 14th Streak day adds none above 2: three missed days are more than the freezes held.
    earned(records, 5, ...october(9, 15));
    expect((await openOn(records, '2026-10-16')).app.progress.state).toMatchObject({
      streak: 14,
      freezesHeld: 2,
    });
    const { app, events } = await openOn(records, '2026-10-19');
    expect(app.progress.state).toMatchObject({ streak: 0, bestStreak: 14, freezesHeld: 2 });
    expect(frozenDays(records)).toEqual(['2026-10-04']);
    expect(events).toEqual([['streakBroken', { streak: 14 }]]);
  });

  it('resets the Streak on a missed day with no freeze, with no repair, and reports it once', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(1, 3));
    await openOn(records, '2026-10-06'); // 2026-10-04 and 05: both freezes.
    earned(records, 5, '2026-10-06');
    const { app, events } = await openOn(records, '2026-10-08'); // 2026-10-07: none left.

    expect(app.progress.state).toMatchObject({ streak: 0, bestStreak: 4, freezesHeld: 0 });
    expect(events).toEqual([['streakBroken', { streak: 4 }]]);

    const again = await openOn(records, '2026-10-08');
    expect(again.events).toEqual([]);
    await earnRounds(again.app, 5, records);
    expect(again.app.progress.state).toMatchObject({ streak: 1, bestStreak: 4 });
  });

  it('resets on a missed day and holds none with the streakFreezes switch off', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 12));
    const { app } = await openOn(records, '2026-10-14', ['xpLog', 'analytics']);

    expect(app.progress.state).toMatchObject({ streak: 0, bestStreak: 3, freezesHeld: 0 });
    expect(frozenDays(records)).toEqual([]);
  });

  it('emits no event with «Ділитися анонімною статистикою» off', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 12));
    records.set('settings.shareCounters', 'false');
    const { app, events } = await openOn(records, '2026-10-14');

    expect(app.progress.state.freezesHeld).toBe(1);
    expect(events).toEqual([]);
  });
});

// Ticket #1371, ADR 0066: a Break of up to 7 days, once every 30 days, free.
describe('the Break', () => {
  const BREAK_ON: readonly FeatureSwitch[] = [...ALL_ON, 'streakBreak'];

  /** The Break-started records of the XP log: start date and length. */
  const breaks = (records: ReadonlyMap<string, string>) =>
    [...records]
      .filter(([key]) => key.startsWith('xp.'))
      .map(([, value]) => JSON.parse(value) as { kind: string; date: string; days?: number })
      .filter(({ kind }) => kind === 'break')
      .map(({ date, days }) => ({ date, days }));

  it('keeps the Streak through its days and adds none, then counts on', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 13));
    const { app, events } = await openOn(records, '2026-10-14', BREAK_ON);
    expect(app.streakBreak.state).toEqual({ kind: 'available', longest: 7 });

    expect(await app.streakBreak.start(7)).toBe('started');
    expect(breaks(records)).toEqual([{ date: '2026-10-14', days: 7 }]);
    expect(app.streakBreak.state).toEqual({ kind: 'running', lastDay: '2026-10-20' });
    expect(events).toEqual([['breakStarted', { days: 7 }]]);

    // The 7 Break days, 14 to 20 October, keep the 4 Streak days and add none.
    const after = await openOn(records, '2026-10-21', BREAK_ON);
    expect(after.app.progress.state).toMatchObject({ streak: 4, bestStreak: 4, freezesHeld: 2 });
    expect(frozenDays(records)).toEqual([]);
    expect(after.events).toEqual([]);
    await earnRounds(after.app, 5, records);
    expect(after.app.progress.state).toMatchObject({ streak: 5, bestStreak: 5 });
  });

  it('keeps nothing after its last day: a missed day then takes a freeze or resets', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 13));
    await (await openOn(records, '2026-10-14', BREAK_ON)).app.streakBreak.start(2);

    const coveredByFreeze = await openOn(records, '2026-10-17', BREAK_ON);
    expect(coveredByFreeze.app.progress.state).toMatchObject({ streak: 4, freezesHeld: 1 });
    expect(frozenDays(records)).toEqual(['2026-10-16']);

    const reset = await openOn(records, '2026-10-20', BREAK_ON);
    expect(reset.app.progress.state).toMatchObject({ streak: 0, bestStreak: 4 });
  });

  it('refuses a second Break within 30 days and allows one from the 30th day', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 13));
    await (await openOn(records, '2026-10-14', BREAK_ON)).app.streakBreak.start(3);

    const within = await openOn(records, '2026-11-12', BREAK_ON);
    expect(within.app.streakBreak.state).toEqual({ kind: 'waiting', nextStart: '2026-11-13' });
    expect(await within.app.streakBreak.start(1)).toBe('refused');
    expect(within.events.filter(([event]) => event === 'breakStarted')).toEqual([]);
    expect(breaks(records)).toEqual([{ date: '2026-10-14', days: 3 }]);

    const running = await openOn(records, '2026-10-15', BREAK_ON);
    expect(running.app.streakBreak.state).toEqual({ kind: 'running', lastDay: '2026-10-16' });
    expect(await running.app.streakBreak.start(1)).toBe('refused');

    const later = await openOn(records, '2026-11-13', BREAK_ON);
    expect(later.app.streakBreak.state).toEqual({ kind: 'available', longest: 7 });
    expect(await later.app.streakBreak.start(1)).toBe('started');
    expect(breaks(records)).toHaveLength(2);
  });

  it('refuses a length of none or over 7 days', async () => {
    const records = new Map<string, string>();
    const { app } = await openOn(records, '2026-10-14', BREAK_ON);

    for (const days of [0, 8, 2.5]) expect(await app.streakBreak.start(days)).toBe('refused');
    expect(breaks(records)).toEqual([]);
  });

  it('is off with the streakBreak switch off: none starts and a missed day counts as before', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 13));
    const { app } = await openOn(records, '2026-10-14', ALL_ON);
    expect(app.streakBreak.state).toEqual({ kind: 'off' });
    expect(await app.streakBreak.start(3)).toBe('refused');
    expect(breaks(records)).toEqual([]);

    const later = await openOn(records, '2026-10-18', ALL_ON);
    expect(later.app.progress.state).toMatchObject({ streak: 0, bestStreak: 4 });
  });

  it('is off with the XP log off', async () => {
    const { app } = await openOn(new Map(), '2026-10-14', ['streakBreak', 'streakFreezes']);
    expect(app.streakBreak.state).toEqual({ kind: 'off' });
    expect(await app.streakBreak.start(3)).toBe('refused');
  });

  it('emits no event with «Ділитися анонімною статистикою» off', async () => {
    const records = earned(new Map<string, string>(), 5, ...october(10, 13));
    records.set('settings.shareCounters', 'false');
    const { app, events } = await openOn(records, '2026-10-14', BREAK_ON);

    expect(await app.streakBreak.start(2)).toBe('started');
    expect(events).toEqual([]);
  });
});
