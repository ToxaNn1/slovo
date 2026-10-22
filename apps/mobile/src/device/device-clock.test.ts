import { systemClock } from '@slovo/core';
import { getCalendars } from 'expo-localization';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deviceClock } from './device-clock';

vi.mock('expo-localization', () => ({ getCalendars: vi.fn() }));

const calendars = (timeZone: string | null) =>
  vi
    .mocked(getCalendars)
    .mockReturnValue([{ timeZone } as ReturnType<typeof getCalendars>[number]]);

/** Each test starts an hour after the one before, so no zone read by another stands. */
let start = Date.UTC(2026, 9, 22, 9);

/** Moves the system time to `ms` after the test's start. */
const at = (ms: number) => {
  vi.setSystemTime(start + ms);
};

describe('the device clock', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    start += 60 * 60 * 1000;
    at(0);
    vi.mocked(getCalendars).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows the device's time zone as it moves", () => {
    calendars('Europe/Kyiv');
    expect(deviceClock.timeZone()).toBe('Europe/Kyiv');

    calendars('Pacific/Auckland');
    at(1000);
    expect(deviceClock.timeZone()).toBe('Pacific/Auckland');
  });

  it('asks the device once for the reads of one moment, such as the rows of one render', () => {
    calendars('Europe/Kyiv');

    const zones = Array.from({ length: 500 }, () => deviceClock.timeZone());
    at(999);
    zones.push(deviceClock.timeZone());

    expect(new Set(zones)).toEqual(new Set(['Europe/Kyiv']));
    expect(getCalendars).toHaveBeenCalledTimes(1);
  });

  it('asks the device again when the clock is set back', () => {
    calendars('Europe/Kyiv');
    deviceClock.timeZone();

    calendars('Pacific/Auckland');
    at(-60 * 1000);
    expect(deviceClock.timeZone()).toBe('Pacific/Auckland');
  });

  it('falls back to the system clock when the device reports no time zone', () => {
    calendars(null);
    expect(deviceClock.timeZone()).toBe(systemClock.timeZone());
  });

  it('tells the time as the system does', () => {
    at(12345);
    expect(deviceClock.now().getTime()).toBe(Date.now());
  });
});
