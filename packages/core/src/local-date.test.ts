import { describe, expect, it } from 'vitest';

import { localDayOf, type Clock } from './index';

/** A clock at a fixed instant, in a time zone the test can change. */
function fakeClock(start: string, timeZone = 'Europe/Kyiv') {
  const now = new Date(start).getTime();
  let zone = timeZone;
  const clock: Clock = { now: () => new Date(now), timeZone: () => zone };
  return {
    clock,
    moveTo(timeZoneName: string) {
      zone = timeZoneName;
    },
  };
}

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
