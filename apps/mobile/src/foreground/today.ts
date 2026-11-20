import { dateKeyOf, localDayOf, type Clock } from '@slovo/core';
import { useCallback, useSyncExternalStore } from 'react';

import { useInForeground } from './in-foreground';
import { everyNextLocalDay } from './next-local-day';

/** Today's local date as its key, which stays the same string all day. */
const todayKeyOf = (clock: Clock) => dateKeyOf(localDayOf(clock.now(), clock).date);

/**
 * Today's local date by `clock` as its key, such as `2026-10-26`, read again
 * at the start of each local day and on each return to the foreground, as a
 * timer may not run in the background. It changes only when the day does.
 */
export function useTodayKey(clock: Clock): string {
  // Draws again on a return to the foreground, which reads the date anew.
  useInForeground();
  // A stable subscription, so a draw does not start the timer again.
  const subscribe = useCallback(
    (onChange: () => void) => everyNextLocalDay(clock, onChange),
    [clock],
  );
  return useSyncExternalStore(subscribe, () => todayKeyOf(clock));
}
