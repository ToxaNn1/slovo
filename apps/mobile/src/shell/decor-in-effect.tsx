import {
  dateKeyOf,
  decorOf,
  localDayOf,
  parseLocalDate,
  untilNextLocalDay,
  type Clock,
} from '@slovo/core';
import { DecorProvider } from '@slovo/ui';
import { useSyncExternalStore, type ReactNode } from 'react';

import { editionDecor, seasonalMotifs } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useInForeground } from '../foreground/in-foreground';
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
  const todayKey = useSyncExternalStore(
    (onChange) => {
      let timer: ReturnType<typeof setTimeout>;
      const waitForTomorrow = () => {
        timer = setTimeout(() => {
          onChange();
          waitForTomorrow();
        }, untilNextLocalDay(clock));
      };
      waitForTomorrow();
      return () => {
        clearTimeout(timer);
      };
    },
    () => todayKeyOf(clock),
  );
  return parseLocalDate(todayKey);
}

/**
 * Gives every Decor slot below the Decor of today (ADR 0055): the Season or
 * Holiday motif in the background and the divider centre while «Сезонний
 * декор» and its Feature Switch are on, the Edition's plain Decor otherwise.
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
