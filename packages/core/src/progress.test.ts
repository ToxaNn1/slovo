import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type UserStateChanges,
  type UserStatePort,
} from './index';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  categories: [{ id: 'test', displayName: 'Test' }],
  userSettingDefaults: {
    mix: { categoryIds: ['test'], corrections: false },
    notificationTimes: [],
  },
};

function word(id: string): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'test',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
  };
}

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

/** A clock the test moves in time and between time zones. */
function fakeClock(start = '2026-10-11T09:00:00+03:00', timeZone = 'Europe/Kyiv') {
  let now = new Date(start).getTime();
  let zone = timeZone;
  const clock: Clock = { now: () => new Date(now), timeZone: () => zone };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
    set(instant: string) {
      now = new Date(instant).getTime();
    },
    moveTo(timeZoneName: string) {
      zone = timeZoneName;
    },
  };
}

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
    edition: { ...testCategories, isFeatureEnabled: () => false },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
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
    expect(app.progress.state).toEqual({ streak: 1, bestStreak: 1 });

    // Opening again the same day, or coming back to it, writes nothing.
    const again = await run({ port, clock: fakeClock('2026-10-11T21:00:00+03:00').clock });
    await again.resume();
    expect(activeDayWrites(writes)).toHaveLength(1);
    expect(again.progress.state).toEqual({ streak: 1, bestStreak: 1 });
  });

  it('counts consecutive Active Days, and a missed day starts it again from 1', async () => {
    const records = new Map<string, string>();

    expect((await runOn(records, '2026-10-11', '2026-10-12')).progress.state.streak).toBe(2);
    expect((await runOn(records, '2026-10-13')).progress.state.streak).toBe(3);

    // 2026-10-14 is missed.
    const afterGap = await runOn(records, '2026-10-15');
    expect(afterGap.progress.state).toEqual({ streak: 1, bestStreak: 3 });
  });

  it('keeps the Best Streak after a reset until a longer Streak beats it', async () => {
    const records = new Map<string, string>();
    await runOn(records, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06');

    expect((await runOn(records, '2026-10-07')).progress.state).toEqual({
      streak: 3,
      bestStreak: 3,
    });
    expect((await runOn(records, '2026-10-08')).progress.state).toEqual({
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
    expect(app.progress.state).toEqual({ streak: 2, bestStreak: 2 });

    // A day later yesterday isn't an Active Day either.
    time.advance(24 * 60 * 60 * 1000);
    await expect(app.resume()).rejects.toThrow('The disk is full');
    expect(app.progress.state).toEqual({ streak: 0, bestStreak: 2 });
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
    expect(app.progress.state).toEqual({ streak: 2, bestStreak: 2 });
    expect(told).toBe(1);

    // The same day again writes nothing, tells nothing and keeps the snapshot.
    const after = app.progress.state;
    await app.resume();
    expect(activeDayWrites(writes)).toHaveLength(2);
    expect(told).toBe(1);
    expect(app.progress.state).toBe(after);
  });

  it('keeps the same snapshot while nothing it shows changes', async () => {
    const app = await run();
    const state = app.progress.state;

    await app.favorites.toggle('w_one');
    await app.resume();

    expect(app.progress.state).toBe(state);
  });
});
