import { describe, expect, it } from 'vitest';

import { localDayOf, parseLocalDate as on, seasonOf } from '../index';
import { fakeClock } from '../test-support';

describe('seasonOf', () => {
  it('follows the meteorological months across each boundary', () => {
    expect(seasonOf(on('2026-02-28'))).toBe('winter');
    expect(seasonOf(on('2026-03-01'))).toBe('spring');
    expect(seasonOf(on('2026-05-31'))).toBe('spring');
    expect(seasonOf(on('2026-06-01'))).toBe('summer');
    expect(seasonOf(on('2026-08-31'))).toBe('summer');
    expect(seasonOf(on('2026-09-01'))).toBe('autumn');
    expect(seasonOf(on('2026-11-30'))).toBe('autumn');
    expect(seasonOf(on('2026-12-01'))).toBe('winter');
    expect(seasonOf(on('2027-01-01'))).toBe('winter');
  });

  it('keeps 29 February of a leap year in winter', () => {
    expect(seasonOf(on('2028-02-29'))).toBe('winter');
    expect(seasonOf(on('2028-03-01'))).toBe('spring');
  });

  it('changes at local midnight in the clock time zone', () => {
    const time = fakeClock('2026-08-31T23:30:00+03:00');
    const today = () => seasonOf(localDayOf(time.clock.now(), time.clock).date);

    expect(today()).toBe('summer');
    time.advance(30 * 60 * 1000);
    expect(today()).toBe('autumn');

    // In London it is still 31 August.
    time.moveTo('Europe/London');
    expect(today()).toBe('summer');
  });
});
