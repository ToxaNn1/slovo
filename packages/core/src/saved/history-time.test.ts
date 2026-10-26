import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  groupByLocalDay,
  openComposition,
  openUserState,
  relativeTimeOf,
  SEEN_DWELL_MS,
  type Clock,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, word } from '../test-support';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  userSettingDefaults: {
    mix: {
      categoryIds: ['test'],
      correctionCategoryIds: 'all' as const,
      corrections: true,
      idioms: true,
      synonymRows: true,
      tips: true,
    },
    notificationTimes: [],
  },
};

const MINUTE = 60 * 1000;

describe('relativeTimeOf', () => {
  it('says "now" within the first minute, and the minutes ago within the first hour', () => {
    const time = fakeClock('2026-10-11T09:30:00+03:00');
    const ago = (ms: number) =>
      relativeTimeOf(new Date(time.clock.now().getTime() - ms), time.clock);

    expect(ago(0)).toEqual({ kind: 'now' });
    expect(ago(59 * 1000)).toEqual({ kind: 'now' });
    expect(ago(MINUTE)).toEqual({ kind: 'minutes', minutes: 1 });
    expect(ago(5 * MINUTE + 20 * 1000)).toEqual({ kind: 'minutes', minutes: 5 });
    expect(ago(29 * MINUTE)).toEqual({ kind: 'minutes', minutes: 29 });
  });

  it('treats an instant ahead of the clock as now', () => {
    const time = fakeClock('2026-10-11T09:30:00+03:00');

    expect(relativeTimeOf(new Date('2026-10-11T09:45:00+03:00'), time.clock)).toEqual({
      kind: 'now',
    });
  });

  it('gives the local time for the rest of today, and for yesterday', () => {
    const time = fakeClock('2026-10-11T18:00:00+03:00');
    const at = (instant: string) => relativeTimeOf(new Date(instant), time.clock);

    expect(at('2026-10-11T09:02:00+03:00')).toEqual({ kind: 'today', hour: 9, minute: 2 });
    expect(at('2026-10-11T00:00:00+03:00')).toEqual({ kind: 'today', hour: 0, minute: 0 });
    expect(at('2026-10-10T21:40:00+03:00')).toEqual({ kind: 'yesterday', hour: 21, minute: 40 });
  });

  it('gives the date for an earlier day, with the time', () => {
    const time = fakeClock('2026-10-11T18:00:00+03:00');

    expect(relativeTimeOf(new Date('2025-12-31T12:05:00+02:00'), time.clock)).toEqual({
      kind: 'date',
      date: { year: 2025, month: 12, day: 31 },
      hour: 12,
      minute: 5,
    });
  });

  it('follows a time-zone change of the clock', () => {
    const time = fakeClock('2026-10-11T00:30:00+03:00');
    const instant = new Date('2026-10-10T23:50:00+03:00');
    // The same instant, 40 minutes ago, is "40 minutes ago" in any zone.
    expect(relativeTimeOf(instant, time.clock)).toEqual({ kind: 'minutes', minutes: 40 });

    // Two hours before, it is yesterday in Kyiv and still today in London.
    const earlier = new Date('2026-10-10T22:00:00+03:00');
    expect(relativeTimeOf(earlier, time.clock)).toEqual({ kind: 'yesterday', hour: 22, minute: 0 });
    time.moveTo('Europe/London');
    expect(relativeTimeOf(earlier, time.clock)).toEqual({ kind: 'today', hour: 20, minute: 0 });
  });
});

describe('groupByLocalDay', () => {
  const entries = [
    { id: 'a', at: new Date('2026-10-11T09:02:00+03:00') },
    { id: 'b', at: new Date('2026-10-11T00:10:00+03:00') },
    { id: 'c', at: new Date('2026-10-10T23:50:00+03:00') },
    { id: 'd', at: new Date('2026-10-10T08:00:00+03:00') },
    { id: 'e', at: new Date('2026-09-30T12:00:00+03:00') },
  ];
  const group = (clock: Clock) =>
    groupByLocalDay(entries, ({ at }) => at, clock).map(({ day, entries: inDay }) => ({
      date: day.date,
      daysAgo: day.daysAgo,
      ids: inDay.map(({ id }) => id),
    }));

  it('groups newest-first items under their local day, today and yesterday first', () => {
    const time = fakeClock('2026-10-11T10:00:00+03:00');

    expect(group(time.clock)).toEqual([
      { date: { year: 2026, month: 10, day: 11 }, daysAgo: 0, ids: ['a', 'b'] },
      { date: { year: 2026, month: 10, day: 10 }, daysAgo: 1, ids: ['c', 'd'] },
      { date: { year: 2026, month: 9, day: 30 }, daysAgo: 11, ids: ['e'] },
    ]);
  });

  it('regroups the same items when the clock changes its time zone', () => {
    const time = fakeClock('2026-10-11T10:00:00+03:00');
    time.moveTo('America/New_York');

    // In New York it is 03:00 on the 11th: `a` (02:02) is still the 11th,
    // `b` (17:10 on the 10th) and `c` (16:50) fall on the 10th with `d`'s 01:00.
    expect(group(time.clock)).toEqual([
      { date: { year: 2026, month: 10, day: 11 }, daysAgo: 0, ids: ['a'] },
      { date: { year: 2026, month: 10, day: 10 }, daysAgo: 1, ids: ['b', 'c', 'd'] },
      { date: { year: 2026, month: 9, day: 30 }, daysAgo: 11, ids: ['e'] },
    ]);
  });

  it('gives no groups for no items', () => {
    expect(groupByLocalDay([], () => new Date(0), fakeClock('2026-10-11T10:00:00Z').clock)).toEqual(
      [],
    );
  });
});

describe('History read through the Core composition', () => {
  it('groups what the Feed marked Seen by the day the clock says, and words its age', async () => {
    const time = fakeClock('2026-10-10T23:00:00+03:00');
    const app = await openComposition({
      content: createMemoryContentPort({ words: [word('w_one'), word('w_two')], corrections: [] }),
      edition: { ...testCategories, isFeatureEnabled: () => false },
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: time.clock,
      random: { next: () => 0.25 },
    });

    // The first card is Seen late on the 10th, the second early on the 11th.
    await app.feed.show(0);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(1);
    time.advance(2 * 60 * MINUTE);
    await app.feed.show(undefined);
    time.advance(5 * MINUTE);

    const days = groupByLocalDay(app.history.list, ({ seenAt }) => seenAt, time.clock);
    expect(days.map(({ day, entries }) => [day.daysAgo, entries.length])).toEqual([
      [0, 1],
      [1, 1],
    ]);
    const [latest] = app.history.list;
    expect(latest && relativeTimeOf(latest.seenAt, time.clock)).toEqual({
      kind: 'minutes',
      minutes: 5,
    });
  });
});
