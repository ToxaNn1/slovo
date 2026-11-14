import { systemClock, type Clock } from '@slovo/core';
import { getCalendars } from 'expo-localization';

import { logWarning } from '../diagnostics/log';

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

/** The milliseconds a test state link moved the clock by: development builds only (#1859). */
let shift = 0;

/**
 * Moves the device clock by `ms` from the system time, 0 taking the shift
 * back; a test state link's `?day=` asks it (#1859). A development build
 * only: a production build tells the system time whatever it is asked.
 */
export function shiftDeviceClock(ms: number): void {
  if (!__DEV__) return;
  shift = ms;
  if (ms !== 0) {
    logWarning(
      'The device clock is shifted by a test state link',
      `${String(Math.round(ms / 3_600_000))} h from the system time. Sync may write shifted times.`,
    );
  }
}

/**
 * The clock the app runs on: the system time, and the time zone from the
 * device's calendar settings (`expo-localization`), so the local day follows
 * the zone the device is in. It falls back to the system clock's zone when
 * the device reports none. A development build can shift it
 * (`shiftDeviceClock`).
 */
export const deviceClock: Clock = {
  now: () =>
    __DEV__ && shift !== 0 ? new Date(systemClock.now().getTime() + shift) : systemClock.now(),
  timeZone: deviceTimeZone,
};
