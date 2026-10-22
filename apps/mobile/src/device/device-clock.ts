import { systemClock, type Clock } from '@slovo/core';
import { getCalendars } from 'expo-localization';

/**
 * How long a time zone read from the device stands, in milliseconds. The
 * device builds its calendar settings anew on each ask, and a screen asks
 * once per row (History groups hundreds), so one render asks once; a zone
 * the device moves to still shows within a second.
 */
const TIME_ZONE_STANDS_MS = 1000;

let lastRead: { readonly timeZone: string; readonly at: number } | undefined;

function deviceTimeZone(): string {
  const at = Date.now();
  // A clock set back reads again too.
  if (lastRead !== undefined && Math.abs(at - lastRead.at) < TIME_ZONE_STANDS_MS) {
    return lastRead.timeZone;
  }
  const timeZone = getCalendars()[0].timeZone ?? systemClock.timeZone();
  lastRead = { timeZone, at };
  return timeZone;
}

/**
 * The clock the app runs on: the system time, and the time zone from the
 * device's calendar settings (`expo-localization`), so the local day follows
 * the zone the device is in. It falls back to the system clock's zone when
 * the device reports none.
 */
export const deviceClock: Clock = {
  now: () => systemClock.now(),
  timeZone: deviceTimeZone,
};
