import { describe, expect, it } from 'vitest';

import { localDayOf, untilNextLocalDay } from './index';
import { fakeClock } from './test-support';

describe('localDayOf', () => {
  it('counts the local days before today in the clock time zone', () => {
    const time = fakeClock('2026-10-11T00:30:00+03:00');
    const at = (instant: string) => localDayOf(new Date(instant), time.clock);

    expect(at('2026-10-11T00:10:00+03:00')).toEqual({
      date: { year: 2026, month: 10, day: 11 },
      daysAgo: 0,
    });
    expect(at('2026-10-10T23:50:00+03:00')).toEqual({
      date: { year: 2026, month: 10, day: 10 },
      daysAgo: 1,
    });
    expect(at('2025-12-31T12:00:00+02:00').daysAgo).toBe(284);

    // In London it is still the day before, so the same instant was today there.
    time.moveTo('Europe/London');
    expect(at('2026-10-10T23:50:00+03:00')).toEqual({
      date: { year: 2026, month: 10, day: 10 },
      daysAgo: 0,
    });
  });
});

describe('untilNextLocalDay', () => {
  const HOUR = 60 * 60 * 1000;
  const until = (instant: string, timeZone = 'Europe/Kyiv') =>
    untilNextLocalDay(fakeClock(instant, timeZone).clock);

  it('counts the time to the next local midnight in the clock time zone', () => {
    expect(until('2026-10-11T09:00:00+03:00')).toBe(15 * HOUR);
    expect(until('2026-10-11T23:59:59.250+03:00')).toBe(750);
    // At midnight the day has just started: the next one is a whole day away.
    expect(until('2026-10-11T00:00:00+03:00')).toBe(24 * HOUR);
    // The same instant is 02:00 in London, two hours later in the day.
    expect(until('2026-10-11T09:00:00+03:00', 'Europe/London')).toBe(17 * HOUR);
  });

  it('follows a daylight-saving change before the next midnight', () => {
    // Kyiv turns its clocks back an hour at 04:00 on 2026-10-25, a 25-hour day.
    expect(until('2026-10-25T00:30:00+03:00')).toBe(24.5 * HOUR);
    // And forward at 03:00 on 2026-03-29, a 23-hour day.
    expect(until('2026-03-29T00:30:00+02:00')).toBe(22.5 * HOUR);
    // In Santiago 2026-09-06 starts at 01:00: its midnight never happens.
    expect(until('2026-09-05T12:00:00-04:00', 'America/Santiago')).toBe(12 * HOUR);
  });
});
