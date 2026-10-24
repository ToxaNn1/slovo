import { groupByLocalDay, type Clock, type EntryRowModel, type HistoryEntry } from '@slovo/core';

import type { historyText } from './history-text';

/** An Entry's row on the History screen. */
export interface HistoryEntryModel {
  readonly entryId: string;
  readonly row: EntryRowModel;
  /** «слово», «виправлення», «фразеологізм», «топонім» or «слово дня». */
  readonly label: string;
}

/** A day on the History screen: its heading and the Entries Seen that day, newest first. */
export interface HistorySection {
  /** The day's local date, which no other section has. */
  readonly key: string;
  /** «Сьогодні», «Учора» or the date. */
  readonly title: string;
  readonly data: readonly HistoryEntryModel[];
}

/**
 * The History screen's sections: the Entries in History grouped under the
 * local day they were Seen, by the clock, newest first.
 */
export function historySections({
  history,
  text,
  clock,
}: {
  history: readonly HistoryEntry[];
  text: Pick<ReturnType<typeof historyText>, 'dayHeading' | 'label'>;
  clock: Clock;
}): readonly HistorySection[] {
  return groupByLocalDay(history, ({ seenAt }) => seenAt, clock).map(({ day, entries }) => ({
    key: `${String(day.date.year)}-${String(day.date.month)}-${String(day.date.day)}`,
    title: text.dayHeading(day),
    data: entries.map((entry) => ({
      entryId: entry.entryId,
      row: entry.row,
      label: text.label(entry),
    })),
  }));
}
