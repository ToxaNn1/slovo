import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type AnalyticsPort,
  type FeatureSwitch,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, settle, testEdition, word } from '../test-support';

// Spec #1358 stories 29, 30 and 85, ticket #1371, ADR 0066: a free Break of up
// to 7 days, once every 30 days, whose days keep the Streak without adding to it.

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

const ALL_ON: readonly FeatureSwitch[] = ['xpLog', 'streakFreezes', 'streakBreak', 'analytics'];

/** One app run over the records, opened at nine in the morning in Kyiv on the date. */
async function openOn(
  records: Map<string, string>,
  date: string,
  on: readonly FeatureSwitch[] = ALL_ON,
) {
  const events: unknown[][] = [];
  const analytics: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock(`${date}T09:00:00+03:00`).clock,
    random: seededRandom(3),
    analytics,
  });
  await settle();
  return { app, events };
}

/** The XP log records of 5 XP from Game Rounds on each local date. */
function earned(records: Map<string, string>, ...dates: string[]) {
  for (const date of dates) {
    records.set(
      `xp.seed-${date}`,
      JSON.stringify({
        kind: 'xp',
        date,
        at: `${date}T09:00:00.000Z`,
        source: 'game-round',
        amount: 5,
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

/** The XP log records of a kind, as the user state keeps them. */
const recordsOf = (records: ReadonlyMap<string, string>, kind: string) =>
  [...records]
    .filter(([key]) => key.startsWith('xp.'))
    .map(([, value]) => JSON.parse(value) as { kind: string })
    .filter((record) => record.kind === kind);

describe('the Break', () => {
  it('starts today, appends its record and emits «Break started»', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    const { app, events } = await openOn(records, '2026-10-05');
    expect(app.progress.state.streakBreak).toEqual({ kind: 'available' });

    expect(await app.progress.startBreak(7)).toBe(true);

    expect(recordsOf(records, 'break')).toEqual([
      { kind: 'break', date: '2026-10-05', at: '2026-10-05T06:00:00.000Z', days: 7 },
    ]);
    expect(app.progress.state.streakBreak).toEqual({ kind: 'on', lastDay: '2026-10-11' });
    expect(events).toEqual([['breakStarted', { days: 7 }]]);
  });

  it('keeps the Streak across its 7 days without adding to it or spending a freeze', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    await (await openOn(records, '2026-10-05')).app.progress.startBreak(7);

    const { app, events } = await openOn(records, '2026-10-12');

    expect(app.progress.state).toMatchObject({ streak: 4, bestStreak: 4, freezesHeld: 2 });
    expect(recordsOf(records, 'freeze')).toEqual([]);
    expect(events).toEqual([]);
  });

  it('counts an Active Day during the Break as a Streak day', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    await (await openOn(records, '2026-10-05')).app.progress.startBreak(3);
    earned(records, '2026-10-06');

    const { app } = await openOn(records, '2026-10-08');

    expect(app.progress.state).toMatchObject({ streak: 5, freezesHeld: 2 });
  });

  it('ends after its length: a missed day after it resets the Streak with no freeze', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    await (await openOn(records, '2026-10-05')).app.progress.startBreak(3);

    const kept = await openOn(records, '2026-10-08', ['xpLog', 'streakBreak']);
    expect(kept.app.progress.state).toMatchObject({
      streak: 4,
      streakBreak: { kind: 'waiting', from: '2026-11-04' },
    });

    const { app } = await openOn(records, '2026-10-09', ['xpLog', 'streakBreak']);
    expect(app.progress.state).toMatchObject({ streak: 0, bestStreak: 4 });
  });

  it('lasts 1 to 7 days: any other length is refused', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    const { app, events } = await openOn(records, '2026-10-05');

    for (const days of [0, 8, 2.5]) expect(await app.progress.startBreak(days)).toBe(false);

    expect(recordsOf(records, 'break')).toEqual([]);
    expect(app.progress.state.streakBreak).toEqual({ kind: 'available' });
    expect(events).toEqual([]);
  });

  it('refuses a second Break within 30 days of the first one’s start', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    await (await openOn(records, '2026-10-05')).app.progress.startBreak(1);

    const during = await openOn(records, '2026-10-05');
    expect(during.app.progress.state.streakBreak).toEqual({ kind: 'on', lastDay: '2026-10-05' });
    expect(await during.app.progress.startBreak(7)).toBe(false);

    const before = await openOn(records, '2026-11-03');
    expect(before.app.progress.state.streakBreak).toEqual({ kind: 'waiting', from: '2026-11-04' });
    expect(await before.app.progress.startBreak(7)).toBe(false);
    expect(recordsOf(records, 'break')).toHaveLength(1);

    const after = await openOn(records, '2026-11-04');
    expect(after.app.progress.state.streakBreak).toEqual({ kind: 'available' });
    expect(await after.app.progress.startBreak(7)).toBe(true);
    expect(recordsOf(records, 'break')).toHaveLength(2);
  });

  it('emits no event with «Ділитися анонімною статистикою» off', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    records.set('settings.shareCounters', 'false');
    const { app, events } = await openOn(records, '2026-10-05');

    expect(await app.progress.startBreak(7)).toBe(true);
    expect(events).toEqual([]);
  });

  it('is off with the streakBreak switch off: none starts and a missed day uses a freeze, as in 0.9', async () => {
    const records = earned(new Map<string, string>(), ...october(1, 4));
    const { app } = await openOn(records, '2026-10-05', ['xpLog', 'streakFreezes']);

    expect(app.progress.state.streakBreak).toEqual({ kind: 'off' });
    expect(await app.progress.startBreak(7)).toBe(false);
    expect(recordsOf(records, 'break')).toEqual([]);

    const next = await openOn(records, '2026-10-06', ['xpLog', 'streakFreezes']);
    expect(next.app.progress.state).toMatchObject({ streak: 4, freezesHeld: 1 });
  });
});
