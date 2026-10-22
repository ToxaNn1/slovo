import { relativeTimeOf, type HistoryEntry } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
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
    history.clear().catch((error: unknown) => {
      console.error('Could not clear History', error);
    });
  };
}

/**
 * The words of History on the device's clock. A relative time reads the clock
 * as it renders, so a screen that comes back into focus renders again and the
 * times it shows are no older than that.
 */
function useHistoryText() {
  const { count } = useEdition();
  // Re-renders the screen when it gains or loses focus, so «щойно» does not go stale.
  useIsFocused();
  return useMemo(
    () => historyText({ strings: editionStrings.history, count, clock: deviceClock }),
    [count],
  );
}

/**
 * The sections of the History screen: the Entries in History under the day
 * they were Seen on the device's clock, kept up to date.
 */
export function useHistorySections(): readonly HistorySection[] {
  const list = useHistoryList();
  const text = useHistoryText();
  return useMemo(() => historySections({ history: list, text, clock: deviceClock }), [list, text]);
}

/** The History card of the Saved tab: the count, the latest rows and what VoiceOver reads for it. */
export interface HistoryPreview {
  readonly count: number;
  /** The latest rows, each a title and how long ago it was Seen. */
  readonly rows: readonly { readonly title: string; readonly trailing: string }[];
  /** The card's name and count, then each latest row with its time in full words. */
  readonly label: string;
}

/**
 * The History card of the Saved tab, with the `latest` rows, kept up to date;
 * each row's time is read on the device's clock as the card renders.
 */
export function useHistoryPreview(latest: number): HistoryPreview {
  const history = useHistoryList();
  const text = useHistoryText();
  const rows = history.slice(0, latest).map(({ row, seenAt }) => ({
    title: row.title,
    ...text.relative(relativeTimeOf(seenAt, deviceClock)),
  }));
  return {
    count: history.length,
    rows: rows.map(({ title, text: trailing }) => ({ title, trailing })),
    label: text.cardLabel(history.length, rows),
  };
}
