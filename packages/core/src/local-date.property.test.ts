import fc from 'fast-check';
import { describe, it } from 'vitest';

import { localDayOf, untilNextLocalDay } from './index';
import { fakeClock } from './test-support';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261027, numRuns: 200 };

const HOUR = 60 * 60 * 1000;

/**
 * Time zones whose daylight-saving changes move the day in different ways:
 * at 03:00 or 04:00 (Kyiv), at 02:00 (New York), by half an hour (Lord Howe),
 * across midnight so a day starts at 01:00 (Santiago), and none (Tokyo).
 */
const timeZones = fc.constantFrom(
  'Europe/Kyiv',
  'America/New_York',
  'Australia/Lord_Howe',
  'America/Santiago',
  'Asia/Tokyo',
);

/**
 * An instant within ten days of a daylight-saving change of 2026 in one of
 * the zones, so most runs cross one.
 */
const instants = fc
  .tuple(
    fc.constantFrom(
      '2026-03-29T01:00:00Z',
      '2026-10-25T01:00:00Z',
      '2026-03-08T07:00:00Z',
      '2026-11-01T06:00:00Z',
      '2026-04-04T15:00:00Z',
      '2026-10-03T15:00:00Z',
      '2026-04-05T03:00:00Z',
      '2026-09-06T04:00:00Z',
    ),
    fc.integer({ min: -240 * HOUR, max: 240 * HOUR }),
  )
  .map(([change, offset]) => new Date(change).getTime() + offset);

/** The day of `instant` as a clock at `now` in the zone counts it. */
const daysAgo = (instant: number, now: number, timeZone: string) =>
  localDayOf(new Date(instant), fakeClock(new Date(now).toISOString(), timeZone).clock).daysAgo;

/** The instant the local day `days` after the one of `instant` starts. */
function dayStartAfter(instant: number, days: number, timeZone: string): number {
  let at = instant;
  for (let i = 0; i < days; i += 1)
    at += untilNextLocalDay(fakeClock(new Date(at).toISOString(), timeZone).clock);
  return at;
}

describe('local dates, for every instant and time zone', () => {
  it('count a day `days` later as `days` days after, and the first day as `days` days before it', () => {
    fc.assert(
      fc.property(instants, timeZones, fc.integer({ min: 0, max: 40 }), (instant, zone, days) => {
        const later = dayStartAfter(instant, days, zone);
        return daysAgo(instant, later, zone) === days && daysAgo(later, instant, zone) === -days;
      }),
      runs,
    );
  });

  it('start the next local day exactly when `untilNextLocalDay` says', () => {
    fc.assert(
      fc.property(instants, timeZones, (instant, zone) => {
        const next = dayStartAfter(instant, 1, zone);
        return daysAgo(next - 1, instant, zone) === 0 && daysAgo(next, instant, zone) === -1;
      }),
      runs,
    );
  });

  it('keep the order of days the order of time', () => {
    fc.assert(
      fc.property(instants, instants, instants, timeZones, (one, other, now, zone) => {
        const [earlier, later] = one <= other ? [one, other] : [other, one];
        return daysAgo(earlier, now, zone) >= daysAgo(later, now, zone);
      }),
      runs,
    );
  });
});
