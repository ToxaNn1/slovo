import { dateKeyOf, decorOf, localDayOf, parseLocalDate, type Clock } from '@slovo/core';
import { DecorProvider } from '@slovo/ui';
import { useCallback, useSyncExternalStore, type ReactNode } from 'react';

import { editionDecor, seasonalMotifs } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useInForeground } from '../foreground/in-foreground';
import { everyNextLocalDay } from '../foreground/next-local-day';
import { useSettings } from '../settings/settings';

/** Today's local date as its key, which stays the same string all day. */
const todayKeyOf = (clock: Clock) => dateKeyOf(localDayOf(clock.now(), clock).date);

/**
 * Today's local date, read again at the start of each local day and on each
 * return to the foreground, as a timer may not run in the background.
 */
function useToday(clock: Clock) {
  // Draws again on a return to the foreground, which reads the date anew.
  useInForeground();
  // A stable subscription, so a draw does not start the timer again.
  const subscribe = useCallback(
    (onChange: () => void) => everyNextLocalDay(clock, onChange),
    [clock],
  );
  const todayKey = useSyncExternalStore(subscribe, () => todayKeyOf(clock));
  return parseLocalDate(todayKey);
}

/**
 * Gives everything below the Decor of today (ADR 0055): the Mascot wears the
 * accessory of the Season or Holiday while «Сезонний декор» and its Feature
 * Switch are on, and the Edition's plain Decor otherwise.
 * It changes at local midnight. Draw it under the gate of the Language Pack.
 */
export function DecorInEffect({ clock, children }: { clock: Clock; children: ReactNode }) {
  const decor = decorOf({
    decor: editionDecor,
    motifs: seasonalMotifs,
    date: useToday(clock),
    edition: useEditionInEffect(),
    settings: useSettings().current,
  });
  return <DecorProvider decor={decor}>{children}</DecorProvider>;
}
