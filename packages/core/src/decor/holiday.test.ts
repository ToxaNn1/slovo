import type { Holiday, SeasonalMotif, SeasonMotifs } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { parseLocalDate as on } from '../index';
import { holidayOf, motifOf } from './holiday';

/** A motif told apart by its tile's width alone. */
function motif(width: number): SeasonalMotif {
  const drawing = {
    width,
    height: 1,
    layers: [{ path: 'M0 0h1v1H0z', light: '#000', dark: '#FFF' }],
  };
  return { tile: drawing, centre: drawing };
}

const seasons: SeasonMotifs = {
  winter: motif(1),
  spring: motif(2),
  summer: motif(3),
  autumn: motif(4),
};

const independenceDay: Holiday = { rule: { kind: 'fixed', day: 24, month: 8 }, motif: motif(10) };
const vyshyvankaDay: Holiday = {
  rule: { kind: 'nthWeekday', nth: 3, weekday: 'thursday', month: 5 },
  motif: motif(11),
};
const christmas: Holiday = { rule: { kind: 'fixed', day: 25, month: 12 }, motif: motif(12) };
const newYear: Holiday = { rule: { kind: 'fixed', day: 1, month: 1 }, motif: motif(13) };

const holidays = [independenceDay, vyshyvankaDay, christmas, newYear];

describe('holidayOf', () => {
  it('finds a fixed-date Holiday on its day and month in any year', () => {
    expect(holidayOf(on('2026-08-24'), holidays)).toBe(independenceDay);
    expect(holidayOf(on('2031-08-24'), holidays)).toBe(independenceDay);
    expect(holidayOf(on('2026-12-25'), holidays)).toBe(christmas);
    expect(holidayOf(on('2027-01-01'), holidays)).toBe(newYear);
  });

  it('misses the days around a fixed-date Holiday', () => {
    expect(holidayOf(on('2026-08-23'), holidays)).toBeUndefined();
    expect(holidayOf(on('2026-08-25'), holidays)).toBeUndefined();
    expect(holidayOf(on('2026-07-24'), holidays)).toBeUndefined();
  });

  it('finds the third Thursday of May, which moves from year to year', () => {
    expect(holidayOf(on('2026-05-21'), holidays)).toBe(vyshyvankaDay);
    expect(holidayOf(on('2027-05-20'), holidays)).toBe(vyshyvankaDay);
    expect(holidayOf(on('2028-05-18'), holidays)).toBe(vyshyvankaDay);
  });

  it('misses the other Thursdays of May and the third Thursday of another month', () => {
    expect(holidayOf(on('2026-05-14'), holidays)).toBeUndefined();
    expect(holidayOf(on('2026-05-28'), holidays)).toBeUndefined();
    expect(holidayOf(on('2027-05-21'), holidays)).toBeUndefined();
    expect(holidayOf(on('2026-06-18'), holidays)).toBeUndefined();
  });

  it('counts from a month that starts on the weekday itself', () => {
    // October 2026 starts on a Thursday: its first Thursday is the 1st.
    const firstThursday: Holiday = {
      rule: { kind: 'nthWeekday', nth: 1, weekday: 'thursday', month: 10 },
      motif: motif(20),
    };
    expect(holidayOf(on('2026-10-01'), [firstThursday])).toBe(firstThursday);
    expect(holidayOf(on('2026-10-08'), [firstThursday])).toBeUndefined();
  });

  it('finds 29 February only in a leap year', () => {
    const leapDay: Holiday = { rule: { kind: 'fixed', day: 29, month: 2 }, motif: motif(21) };
    expect(holidayOf(on('2028-02-29'), [leapDay])).toBe(leapDay);
    expect(holidayOf(on('2027-03-01'), [leapDay])).toBeUndefined();
  });

  it('finds nothing when the Edition lists no Holidays', () => {
    expect(holidayOf(on('2026-08-24'), [])).toBeUndefined();
  });
});

describe('motifOf', () => {
  it('shows the Holiday motif instead of the Season motif', () => {
    expect(motifOf(on('2026-08-24'), { seasons, holidays })).toBe(independenceDay.motif);
    expect(motifOf(on('2026-05-21'), { seasons, holidays })).toBe(vyshyvankaDay.motif);
    expect(motifOf(on('2026-12-25'), { seasons, holidays })).toBe(christmas.motif);
    expect(motifOf(on('2027-01-01'), { seasons, holidays })).toBe(newYear.motif);
  });

  it('shows the Season motif on an ordinary day', () => {
    expect(motifOf(on('2027-01-02'), { seasons, holidays })).toBe(seasons.winter);
    expect(motifOf(on('2026-05-22'), { seasons, holidays })).toBe(seasons.spring);
    expect(motifOf(on('2026-08-25'), { seasons, holidays })).toBe(seasons.summer);
    expect(motifOf(on('2026-10-28'), { seasons, holidays })).toBe(seasons.autumn);
  });

  it('shows the Season motif every day when the Edition lists no Holidays', () => {
    expect(motifOf(on('2026-08-24'), { seasons, holidays: [] })).toBe(seasons.summer);
  });
});
