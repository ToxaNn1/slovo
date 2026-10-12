import { systemClock } from '@slovo/core';
import { getCalendars } from 'expo-localization';
import { describe, expect, it, vi } from 'vitest';

import { deviceClock } from './device-clock';

vi.mock('expo-localization', () => ({ getCalendars: vi.fn() }));

const calendars = (timeZone: string | null) =>
  vi
    .mocked(getCalendars)
    .mockReturnValue([{ timeZone } as ReturnType<typeof getCalendars>[number]]);

describe('the device clock', () => {
  it("follows the device's time zone, each time it is asked", () => {
    calendars('Europe/Kyiv');
    expect(deviceClock.timeZone()).toBe('Europe/Kyiv');

    calendars('Pacific/Auckland');
    expect(deviceClock.timeZone()).toBe('Pacific/Auckland');
  });

  it('falls back to the system clock when the device reports no time zone', () => {
    calendars(null);
    expect(deviceClock.timeZone()).toBe(systemClock.timeZone());
  });

  it('tells the time as the system does', () => {
    expect(Math.abs(deviceClock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
