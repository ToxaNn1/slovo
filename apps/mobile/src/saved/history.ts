import { localDayOf, type EntryRowModel, type HistoryEntry } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';
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

/** The device's local day, as a key: it changes at midnight, in the device's time zone. */
function deviceDay(): string {
  const { year, month, day } = localDayOf(deviceClock.now(), deviceClock).date;
  return `${String(year)}-${String(month)}-${String(day)}`;
}

/** The clock tells no one when the day turns; a render reads it again. */
const dayNeverTells = () => () => undefined;

/**
 * The device's day, read again on every render. React reads a store's
 * snapshot on each render, so the React Compiler cannot keep an old day
 * the way it keeps a value read in render from outside React.
 */
function useDeviceDay(): string {
  return useSyncExternalStore(dayNeverTells, deviceDay);
}

/** Each Entry's row with the day it was made for, so a row is made once a day. */
const rowsMade = new WeakMap<HistoryEntry, { readonly on: string; readonly row: HistoryRow }>();

function historyRow(entry: HistoryEntry, on: string): HistoryRow {
  const made = rowsMade.get(entry);
  if (made?.on === on) return made.row;
  const row = { entryId: entry.entryId, row: entry.row, day: dayChip(entry.seenAt) };
  rowsMade.set(entry, { on, row });
  return row;
}

/**
 * The rows of the History screen (board 09): one list, newest first, each
 * with the day it was Seen on the device's clock, kept up to date. The day is
 * read on each render, focus included, so a screen that comes back on a new
 * day says «вчора» for yesterday's Entries. A row whose Entry and day did not
 * change stays the same row, so the list does not draw it again.
 */
export function useHistoryRows(): readonly HistoryRow[] {
  const list = useHistoryList();
  // Re-renders the screen when it gains or loses focus, so «сьогодні» does not go stale.
  useIsFocused();
  const today = useDeviceDay();
  return list.map((entry) => historyRow(entry, today));
}

/**
 * How many Entries History holds, kept up to date. It reads the count alone,
 * so a change that leaves the count as it was does not render its reader.
 */
export function useHistoryCount(): number {
  return useSubscribed(useComposition().history, ({ list }) => list.length);
}
