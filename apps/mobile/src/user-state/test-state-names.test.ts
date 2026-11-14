import { dateKeyOf, formatTimeOfDay, localTimeOf, todayDate, type Clock } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { dayShiftOf, testStateOf } from './test-states';

describe('a test state link', () => {
  it('names its test state, with the scheme or as a path', () => {
    expect(testStateOf('slovo://dev/state/level-7')).toEqual({ name: 'level-7' });
    expect(testStateOf('/dev/state/full-saved/')).toEqual({ name: 'full-saved' });
  });

  it('names its test state behind Expo Go’s `/--/` prefix', () => {
    expect(testStateOf('exp://127.0.0.1:8197/--/dev/state/fresh')).toEqual({ name: 'fresh' });
    expect(testStateOf('/--/dev/state/fresh')).toEqual({ name: 'fresh' });
    expect(testStateOf('exp://127.0.0.1:8197/--/entry/w_one')).toBeUndefined();
  });

  it('names none for an unknown name or the bare list link', () => {
    expect(testStateOf('slovo://dev/state/level-99')).toBe('unknown');
    expect(testStateOf('slovo://dev/state')).toBe('unknown');
  });

  it('is no test state link for any other link', () => {
    expect(testStateOf('slovo://entry/w_one')).toBeUndefined();
    expect(testStateOf('https://slovo.app/uk/c/abc')).toBeUndefined();
  });
});

describe('the day a test state link shifts to', () => {
  /** Wednesday 21 October 2026, 14:30 in Kyiv; the clocks go back on Sunday the 25th. */
  const now = new Date(Date.UTC(2026, 9, 21, 11, 30));
  const clock: Clock = { now: () => now, timeZone: () => 'Europe/Kyiv' };

  /** The local day and time of day the link's shift moves the clock to. */
  const shiftedBy = (link: string) => {
    const shift = dayShiftOf(link, clock);
    if (shift === undefined || shift === 'unknown') return shift;
    const shifted: Clock = { ...clock, now: () => new Date(now.getTime() + shift.shift) };
    return {
      day: dateKeyOf(todayDate(shifted)),
      time: formatTimeOfDay(localTimeOf(shifted.now(), shifted)),
    };
  };

  it('is the next such weekday for ?day=<weekday>, today included, at the same time of day', () => {
    expect(shiftedBy('slovo://dev/state/weekly-recap?day=monday')).toEqual({
      day: '2026-10-26',
      time: '14:30',
    });
    expect(shiftedBy('slovo://dev/state/fresh?day=Friday')).toEqual({
      day: '2026-10-23',
      time: '14:30',
    });
    expect(shiftedBy('slovo://dev/state/fresh?day=wednesday')).toEqual({
      day: '2026-10-21',
      time: '14:30',
    });
  });

  it('is the date for ?day=<YYYY-MM-DD>, past or future, at the same time of day', () => {
    expect(shiftedBy('slovo://dev/state/fresh?day=2026-12-31')).toEqual({
      day: '2026-12-31',
      time: '14:30',
    });
    expect(shiftedBy('exp://127.0.0.1:8197/--/dev/state/fresh?x=1&day=2026-03-02')).toEqual({
      day: '2026-03-02',
      time: '14:30',
    });
  });

  it('is no shift without the parameter', () => {
    expect(dayShiftOf('slovo://dev/state/weekly-recap', clock)).toBeUndefined();
    expect(dayShiftOf('slovo://dev/state/weekly-recap?other=1', clock)).toBeUndefined();
  });

  it('is unknown for a day that is neither a weekday nor a date', () => {
    expect(dayShiftOf('slovo://dev/state/fresh?day=someday', clock)).toBe('unknown');
    expect(dayShiftOf('slovo://dev/state/fresh?day=2026-02-30', clock)).toBe('unknown');
    expect(dayShiftOf('slovo://dev/state/fresh?day=', clock)).toBe('unknown');
  });
});
