import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type FeatureSwitch,
  type UserStateChanges,
  type UserStatePort,
} from '../index';
import { createMemoryContentPort } from '../testing';
import {
  correction,
  fakeClock,
  knownCounts,
  steppingRandom,
  synonymRow,
  testEdition,
  tip,
  word,
} from '../test-support';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

/** A user-state port over the records that keeps every write it is given. */
function recordingPort(records: Map<string, string>) {
  const port = createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  return {
    writes,
    port: {
      ...port,
      write(changes) {
        writes.push(changes);
        return port.write(changes);
      },
    } satisfies UserStatePort,
  };
}

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  clock = fakeClock().clock,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  clock?: Clock;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: () => false,
      userSettingDefaults: { mix: { corrections: false } },
    }),
    userState: await openUserState({ port }),
    clock,
    random: steppingRandom(),
  });
}

/** Opens the app once on each local date, at nine in the morning in Kyiv. */
async function runOn(records: Map<string, string>, ...dates: string[]): Promise<Composition> {
  let app: Composition | undefined;
  for (const date of dates) {
    app = await run({ records, clock: fakeClock(`${date}T09:00:00+03:00`).clock });
  }
  if (app === undefined) throw new Error('No date to open the app on');
  return app;
}

/** The local dates recorded as Active Days, in date order. */
const activeDays = (records: ReadonlyMap<string, string>) =>
  [...records.keys()]
    .filter((key) => key.startsWith('activeDays.'))
    .map((key) => key.slice('activeDays.'.length))
    .sort();

/** The writes that recorded an Active Day. */
const activeDayWrites = (writes: readonly UserStateChanges[]) =>
  writes.filter((changes) => [...changes.keys()].some((key) => key.startsWith('activeDays.')));

describe('Active Days and the Streak', () => {
  it('records today once when the app opens, and the Streak is 1 on the first day', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);

    const app = await run({ port });

    expect(activeDays(records)).toEqual(['2026-10-11']);
    expect(records.get('activeDays.2026-10-11')).toBe('true');
    expect(app.progress.state).toMatchObject({ streak: 1, bestStreak: 1 });

    // Opening again the same day, or coming back to it, writes nothing.
    const again = await run({ port, clock: fakeClock('2026-10-11T21:00:00+03:00').clock });
    await again.resume();
    expect(activeDayWrites(writes)).toHaveLength(1);
    expect(again.progress.state).toMatchObject({ streak: 1, bestStreak: 1 });
  });

  it('counts consecutive Active Days, and a missed day starts it again from 1', async () => {
    const records = new Map<string, string>();

    expect((await runOn(records, '2026-10-11', '2026-10-12')).progress.state.streak).toBe(2);
    expect((await runOn(records, '2026-10-13')).progress.state.streak).toBe(3);

    // 2026-10-14 is missed.
    const afterGap = await runOn(records, '2026-10-15');
    expect(afterGap.progress.state).toMatchObject({ streak: 1, bestStreak: 3 });
  });

  it('keeps the Best Streak after a reset until a longer Streak beats it', async () => {
    const records = new Map<string, string>();
    await runOn(records, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06');

    expect((await runOn(records, '2026-10-07')).progress.state).toMatchObject({
      streak: 3,
      bestStreak: 3,
    });
    expect((await runOn(records, '2026-10-08')).progress.state).toMatchObject({
      streak: 4,
      bestStreak: 4,
    });
  });

  it('counts back from yesterday while today is not an Active Day yet', async () => {
    const records = new Map<string, string>();
    await runOn(records, '2026-10-11', '2026-10-12');
    const time = fakeClock('2026-10-12T23:00:00+03:00');
    let failing = false;
    const port = createMemoryUserStatePort(records);
    const app = await run({
      records,
      clock: time.clock,
      port: {
        ...port,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
      },
    });

    // 2026-10-13 starts, but keeping it as an Active Day fails.
    failing = true;
    time.advance(2 * 60 * 60 * 1000);
    await expect(app.resume()).rejects.toThrow('The disk is full');

    expect(activeDays(records)).toEqual(['2026-10-11', '2026-10-12']);
    expect(app.progress.state).toMatchObject({ streak: 2, bestStreak: 2 });

    // A day later yesterday isn't an Active Day either.
    time.advance(24 * 60 * 60 * 1000);
    await expect(app.resume()).rejects.toThrow('The disk is full');
    expect(app.progress.state).toMatchObject({ streak: 0, bestStreak: 2 });
  });

  it('follows the local date of the time zone the device is in', async () => {
    const records = new Map<string, string>();
    // 22:00 in Kyiv on 2026-10-11.
    const time = fakeClock('2026-10-11T22:00:00+03:00');
    const app = await run({ records, clock: time.clock });

    // An hour later the reader lands in Tokyo, where it is already 2026-10-12.
    time.advance(60 * 60 * 1000);
    time.moveTo('Asia/Tokyo');
    await app.resume();
    expect(activeDays(records)).toEqual(['2026-10-11', '2026-10-12']);
    expect(app.progress.state.streak).toBe(2);

    // Then on to New York, where it is 2026-10-12 still: no new day, and none lost.
    time.advance(12 * 60 * 60 * 1000);
    time.moveTo('America/New_York');
    await app.resume();
    expect(activeDays(records)).toEqual(['2026-10-11', '2026-10-12']);
    expect(app.progress.state.streak).toBe(2);

    // The next morning in New York is the next Active Day.
    time.set('2026-10-13T09:00:00-04:00');
    await app.resume();
    expect(activeDays(records)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
    expect(app.progress.state.streak).toBe(3);
  });

  it('survives a new Cycle and a cleared History', async () => {
    const records = new Map<string, string>();
    await runOn(records, '2026-10-11');
    const time = fakeClock('2026-10-12T09:00:00+03:00');
    const app = await run({ records, clock: time.clock });
    // Read every card, then the card after the end-of-Cycle card starts a new Cycle.
    while (app.feed.cards.at(-1)?.kind !== 'end-of-cycle') {
      await app.feed.show(app.feed.cards.length - 1);
      time.advance(SEEN_DWELL_MS);
      await app.feed.show(undefined);
    }
    await app.feed.show(app.feed.cards.length - 1);
    await app.feed.show(undefined);
    await app.history.clear();

    expect(app.history.list).toEqual([]);
    expect(app.progress.state.streak).toBe(2);
    expect((await run({ records, clock: time.clock })).progress.state.streak).toBe(2);
  });

  it('records a new local day that starts while the app is open, with a new snapshot', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    const time = fakeClock('2026-10-11T23:59:00+03:00');
    const app = await run({ port, clock: time.clock });
    const before = app.progress.state;
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    time.advance(2 * 60 * 1000);
    await app.resume();

    expect(activeDays(records)).toEqual(['2026-10-11', '2026-10-12']);
    expect(app.progress.state).not.toBe(before);
    expect(app.progress.state).toMatchObject({ streak: 2, bestStreak: 2 });
    expect(told).toBe(1);

    // The same day again writes nothing, tells nothing and keeps the snapshot.
    const after = app.progress.state;
    await app.resume();
    expect(activeDayWrites(writes)).toHaveLength(2);
    expect(told).toBe(1);
    expect(app.progress.state).toBe(after);
  });
});

describe('The stats sheet’s numbers', () => {
  /** Keeps the Feed's card at `position` on screen long enough to make its Entry Seen. */
  async function look(app: Composition, time: ReturnType<typeof fakeClock>, position: number) {
    await app.feed.show(position);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(undefined);
  }

  it('counts nothing on the first day before the reader keeps or reads anything', async () => {
    const app = await run();

    expect(app.progress.state).toEqual({
      streak: 1,
      bestStreak: 1,
      freezesHeld: 0,
      streakBreak: { kind: 'off' },
      seenToday: 0,
      favorites: 0,
      inCollections: 0,
      known: knownCounts(),
      dueToday: 0,
    });
  });

  it('counts the History entries Seen on today’s local date, in the time zone the device is in', async () => {
    // 23:50 in Kyiv on 2026-10-11.
    const time = fakeClock('2026-10-11T23:50:00+03:00');
    const app = await run({ clock: time.clock });

    await look(app, time, 0);
    expect(app.progress.state.seenToday).toBe(1);

    // Kyiv's 2026-10-12 starts: the Entry was Seen yesterday.
    time.set('2026-10-12T00:05:00+03:00');
    await app.resume();
    expect(app.progress.state.seenToday).toBe(0);

    await look(app, time, 1);
    expect(app.progress.state.seenToday).toBe(1);

    // In New York both were Seen on 2026-10-11, which is today there.
    time.moveTo('America/New_York');
    await app.resume();
    expect(app.progress.state.seenToday).toBe(2);
    expect(app.history.list).toHaveLength(2);
  });

  it('starts today with a daylight-saving change that skips midnight', async () => {
    // In Santiago 2026-09-06 starts at 01:00: its midnight never happens.
    const time = fakeClock('2026-09-05T23:50:00-04:00', 'America/Santiago');
    const app = await run({ clock: time.clock });
    await look(app, time, 0);

    time.set('2026-09-06T01:05:00-03:00');
    await app.resume();
    expect(app.progress.state.seenToday).toBe(0);

    await look(app, time, 1);
    expect(app.progress.state.seenToday).toBe(1);
  });

  it('counts the Entries in Favorites and changes at once on a heart', async () => {
    const app = await run();
    const before = app.progress.state;
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    await app.favorites.toggle('w_one');
    expect(app.progress.state).not.toBe(before);
    expect(app.progress.state.favorites).toBe(1);
    expect(told).toBe(1);

    await app.favorites.toggle('w_two');
    await app.favorites.toggle('w_one');
    expect(app.progress.state.favorites).toBe(1);
    expect(told).toBe(3);
  });

  it('counts an Entry in several Collections once, and changes at once on a Collection change', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const first = await app.collections.create('Для листів', 'w_one');
    const second = await app.collections.create('Улюблені звуки', 'w_one');
    if (!first.ok || !second.ok) throw new Error('The Collections were not made');
    expect(app.progress.state.inCollections).toBe(1);

    const before = app.progress.state;
    await app.collections.add(second.collection.id, 'w_two');
    expect(app.progress.state).not.toBe(before);
    expect(app.progress.state.inCollections).toBe(2);

    await app.collections.delete(first.collection.id);
    expect(app.progress.state.inCollections).toBe(2);

    await app.collections.remove(second.collection.id, 'w_one');
    expect(app.progress.state.inCollections).toBe(1);

    // The next app run reads the same numbers from the user state.
    await app.favorites.add('w_one');
    expect((await run({ records })).progress.state).toEqual(app.progress.state);
  });

  it('keeps the same snapshot while nothing it shows changes', async () => {
    const app = await run();
    const created = await app.collections.create('Для листів', 'w_one');
    if (!created.ok) throw new Error('The Collection was not made');
    const state = app.progress.state;
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    // An empty Collection, a new name, an Entry already in another Collection and the same day again.
    const other = await app.collections.create('Порожня');
    if (!other.ok) throw new Error('The Collection was not made');
    await app.collections.rename(created.collection.id, 'Для листів і віршів');
    await app.collections.add(other.collection.id, 'w_one');
    await app.resume();

    expect(app.progress.state).toBe(state);
    expect(told).toBe(0);
  });
});

// Spec #461, ADR 0043: the counts the statistics show from the Knowledge Marks.
describe('The knowledge counts', () => {
  const DAY = 24 * 60 * 60_000;

  /** The Core composition over a pack with Words and a Correction, with `on` the Feature Switches turned on. */
  async function runKnowing(
    clock: Clock,
    { on = ['knowledge', 'corrections'] }: { on?: readonly FeatureSwitch[] } = {},
  ): Promise<Composition> {
    return openComposition({
      content: createMemoryContentPort({
        words: [word('w_one'), word('w_two'), word('w_three')],
        corrections: [correction('c_one'), correction('c_two')],
      }),
      edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock,
      random: steppingRandom(),
    });
  }

  const countsOf = ({ known, dueToday }: Composition['progress']['state']) => ({
    known,
    dueToday,
  });

  it('counts Known and Learned Words and Corrections apart, and changes at once on a mark', async () => {
    const app = await runKnowing(fakeClock('2026-10-19T09:00:00+03:00').clock);
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('w_two', 'unknown');
    await app.knowledge.tap('c_one', 'known');
    await app.knowledge.tap('c_two', 'unknown');

    expect(countsOf(app.progress.state)).toEqual({
      known: knownCounts({ word: 1, correction: 1 }),
      dueToday: 0,
    });
    // An Unknown mark is due tomorrow, so it changes no number today.
    expect(told).toBe(2);
  });

  it('counts Known Synonym Rows and Tips apart from Words, Corrections and Idioms', async () => {
    const app = await openComposition({
      content: createMemoryContentPort({
        words: [word('w_one')],
        synonymRows: [synonymRow('s_one'), synonymRow('s_two')],
        tips: [tip('t_one')],
      }),
      edition: testEdition({
        isFeatureEnabled: (feature) => feature === 'knowledge',
        userSettingDefaults: { mix: { corrections: false } },
      }),
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: fakeClock('2026-10-19T09:00:00+03:00').clock,
      random: steppingRandom(),
    });

    await app.knowledge.tap('s_one', 'known');
    await app.knowledge.tap('s_two', 'known');
    await app.knowledge.tap('t_one', 'known');

    expect(countsOf(app.progress.state)).toEqual({
      known: knownCounts({ synonymRow: 2, tip: 1 }),
      dueToday: 0,
    });
  });

  it('keeps the same snapshot and tells no one when an unmarked Entry is marked Unknown', async () => {
    const app = await runKnowing(fakeClock('2026-10-19T09:00:00+03:00').clock);
    const before = app.progress.state;
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    await app.knowledge.tap('w_one', 'unknown');

    expect(app.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(app.progress.state).toBe(before);
    expect(told).toBe(0);
  });

  it('counts an Entry due for Review today, and a Known answer on the Review as Known', async () => {
    const time = fakeClock('2026-10-19T09:00:00+03:00');
    const app = await runKnowing(time.clock);
    await app.knowledge.tap('w_two', 'unknown');
    await app.knowledge.tap('c_two', 'unknown');

    time.advance(DAY);
    await app.resume();
    expect(countsOf(app.progress.state)).toEqual({
      known: knownCounts(),
      dueToday: 2,
    });

    await app.knowledge.tap('w_two', 'known');
    expect(countsOf(app.progress.state)).toEqual({
      known: knownCounts({ word: 1 }),
      dueToday: 1,
    });
  });

  it('stops counting an Entry whose mark is removed', async () => {
    const app = await runKnowing(fakeClock('2026-10-19T09:00:00+03:00').clock);
    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('c_one', 'known');

    await app.knowledge.tap('w_one', 'known');

    expect(countsOf(app.progress.state)).toEqual({
      known: knownCounts({ correction: 1 }),
      dueToday: 0,
    });
  });

  it('leaves a Hidden Entry out of the Entries due today, and counts it again once restored', async () => {
    const time = fakeClock('2026-10-19T09:00:00+03:00');
    const app = await runKnowing(time.clock);
    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('c_one', 'unknown');
    time.advance(DAY);
    await app.resume();

    await app.hiddenEntries.hide('w_one');
    expect(app.progress.state.dueToday).toBe(1);

    await app.hiddenEntries.restore('w_one');
    expect(app.progress.state.dueToday).toBe(2);
  });

  it('counts an Entry marked late at night as due on the next local day', async () => {
    // 23:30 in Kyiv is still the same day in UTC an hour later, at 00:30 local.
    const time = fakeClock('2026-10-19T23:30:00+03:00');
    const app = await runKnowing(time.clock);
    await app.knowledge.tap('w_one', 'unknown');

    time.advance(20 * 60_000);
    await app.resume();
    expect(app.progress.state.dueToday).toBe(0);

    time.advance(40 * 60_000);
    await app.resume();
    expect(app.progress.state.dueToday).toBe(1);
  });

  it('counts nothing with the knowledge Feature Switch off', async () => {
    const app = await runKnowing(fakeClock('2026-10-19T09:00:00+03:00').clock, {
      on: ['corrections'],
    });

    await app.knowledge.tap('w_one', 'known');

    expect(countsOf(app.progress.state)).toEqual({
      known: knownCounts(),
      dueToday: 0,
    });
  });
});

describe('The Active Days calendar', () => {
  /** Opens the app on each local date with the Active Days calendar on, unless `calendarOn` is false. */
  async function openWithCalendar(
    records: Map<string, string>,
    dates: readonly string[],
    calendarOn = true,
  ): Promise<Composition> {
    let app: Composition | undefined;
    for (const date of dates) {
      app = await openComposition({
        content,
        edition: testEdition({
          isFeatureEnabled: (feature) => calendarOn && feature === 'activeDaysCalendar',
          userSettingDefaults: { mix: { corrections: false } },
        }),
        userState: await openUserState({ port: createMemoryUserStatePort(records) }),
        clock: fakeClock(`${date}T09:00:00+03:00`).clock,
        random: steppingRandom(),
      });
    }
    if (app === undefined) throw new Error('No date to open the app on');
    return app;
  }

  const letters = { active: 'a', missed: 'm', today: 't', future: 'f' } as const;

  /** Each month as `YYYY-MM` and its weeks, a day as its number and state, `t*` today when it is an Active Day, `.` no day. */
  const shown = (app: Composition) =>
    app.progress.calendar().map(({ year, month, weeks }) => ({
      month: `${String(year)}-${String(month).padStart(2, '0')}`,
      weeks: weeks.map((week) =>
        week
          .map((day) =>
            day === undefined
              ? '.'
              : `${String(day.day)}${letters[day.state]}${day.state === 'today' && day.active ? '*' : ''}`,
          )
          .join(' '),
      ),
    }));

  it('lays out a month starting on a Sunday from Monday, with today outlined and the rest to come', async () => {
    // 2026-11-01 is a Sunday.
    const app = await openWithCalendar(new Map(), ['2026-11-01', '2026-11-03']);

    expect(shown(app)).toEqual([
      {
        month: '2026-11',
        weeks: [
          '. . . . . . 1a',
          '2m 3t* 4f 5f 6f 7f 8f',
          '9f 10f 11f 12f 13f 14f 15f',
          '16f 17f 18f 19f 20f 21f 22f',
          '23f 24f 25f 26f 27f 28f 29f',
          '30f . . . . . .',
        ],
      },
    ]);
    const [first] = app.progress.calendar()[0]?.weeks[0]?.slice(6) ?? [];
    expect(first).toEqual({ date: '2026-11-01', day: 1, state: 'active' });
  });

  it('runs from the first Active Day’s month to the current one, and no further', async () => {
    const app = await openWithCalendar(new Map(), ['2026-09-30', '2026-10-12', '2026-11-03']);

    const months = shown(app);
    expect(months.map(({ month }) => month)).toEqual(['2026-09', '2026-10', '2026-11']);
    // September 2026 starts on a Tuesday; its days before the first Active Day are missed.
    expect(months[0]?.weeks[0]).toBe('. 1m 2m 3m 4m 5m 6m');
    expect(months[0]?.weeks.at(-1)).toBe('28m 29m 30a . . . .');
    expect(months[1]?.weeks[2]).toBe('12a 13m 14m 15m 16m 17m 18m');
    expect(months[2]?.weeks[0]).toBe('. . . . . . 1m');
  });

  it('shows no future month, even for an Active Day kept ahead of a clock moved back', async () => {
    const records = new Map<string, string>();
    await openWithCalendar(records, ['2026-12-02']);

    const app = await openWithCalendar(records, ['2026-11-03']);

    const months = shown(app);
    expect(months.map(({ month }) => month)).toEqual(['2026-11']);
    expect(months[0]?.weeks[1]).toBe('2m 3t* 4f 5f 6f 7f 8f');
  });

  it('shows no month with the Active Days calendar off', async () => {
    const app = await openWithCalendar(new Map(), ['2026-11-03'], false);

    expect(app.progress.calendar()).toEqual([]);
  });
});
