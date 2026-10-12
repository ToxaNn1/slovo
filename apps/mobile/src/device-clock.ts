import { systemClock, type Clock } from '@slovo/core';
import { getCalendars } from 'expo-localization';

/**
 * The clock the app runs on: the system time, and the time zone from the
 * device's calendar settings (`expo-localization`), so the local day follows
 * the zone the device is in. It falls back to the system clock's zone when
 * the device reports none.
 */
export const deviceClock: Clock = {
  now: () => systemClock.now(),
  timeZone: () => getCalendars()[0].timeZone ?? systemClock.timeZone(),
};
