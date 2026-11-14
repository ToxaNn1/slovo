import type { EntryRowModel, HistoryEntry } from '@slovo/core';
import { useIsFocused } from 'expo-router';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { dayChip } from './added-on';

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

/** An Entry's row on the History screen: the Entry and the day it was Seen, on its chip. */
export interface HistoryRow {
  readonly entryId: string;
  readonly row: EntryRowModel;
  readonly day: ReturnType<typeof dayChip>;
}

/**
 * The rows of the History screen (board 09): one list, newest first, each
 * with the day it was Seen on the device's clock, kept up to date. The day is
 * read on each render, focus included, so a screen that comes back on a new
 * day says «вчора» for yesterday's Entries.
 */
export function useHistoryRows(): readonly HistoryRow[] {
  const list = useHistoryList();
  // Re-renders the screen when it gains or loses focus, so «сьогодні» does not go stale.
  useIsFocused();
  return list.map(({ entryId, row, seenAt }) => ({ entryId, row, day: dayChip(seenAt) }));
}

/** How many Entries History holds, kept up to date. */
export function useHistoryCount(): number {
  return useHistoryList().length;
}
