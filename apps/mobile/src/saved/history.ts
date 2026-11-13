import { dateKeyOf, todayDate, type HistoryEntry } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { historySections, type HistorySection } from './history-screen';
import { historyText } from './history-text';

/** The Entries in History, newest first, kept up to date. */
function useHistoryList(): readonly HistoryEntry[] {
  return useSubscribed(useComposition().history, ({ list }) => list);
}

/**
 * Clears History. A change that could not be kept is logged and leaves History
 * as it was.
 */
export function useClearHistory(): () => void {
  const { history } = useComposition();
  return () => {
    void keep('History', history.clear());
  };
}

/**
 * The words of History on the device's clock. A day heading reads the clock
 * as it renders, so a screen that comes back into focus renders again and its
 * «Сьогодні» is no older than that.
 */
function useHistoryText() {
  // Re-renders the screen when it gains or loses focus, so «Сьогодні» does not go stale.
  useIsFocused();
  return useMemo(
    () =>
      historyText({
        strings: editionStrings.history,
        dates: editionStrings.dates,
        clock: deviceClock,
      }),
    [],
  );
}

/**
 * The sections of the History screen: the Entries in History under the day
 * they were Seen on the device's clock, kept up to date. Today's local day is
 * read on each render, focus included, so a screen that comes back on a new
 * day heads yesterday's Entries «Учора».
 */
export function useHistorySections(): readonly HistorySection[] {
  const list = useHistoryList();
  const text = useHistoryText();
  const today = dateKeyOf(todayDate(deviceClock));
  // The sections carry the day they were built on, so a new local day builds them again.
  const built = useMemo(
    () => ({ today, sections: historySections({ history: list, text, clock: deviceClock }) }),
    [list, text, today],
  );
  return built.sections;
}

/** How many Entries History holds, kept up to date. */
export function useHistoryCount(): number {
  return useHistoryList().length;
}
