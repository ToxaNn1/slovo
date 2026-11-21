import { fill, type EditionStrings } from '@slovo/contracts';
import { localDayOf, localTimeOf, type Clock, type SyncState } from '@slovo/core';

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** The status line's text, and whether it marks the words synced. */
export interface SyncStatus {
  readonly text: string;
  /** Whether the last sync went through: none runs, and none found no network or was refused. */
  readonly synced: boolean;
}

/**
 * The status line under the email of the SLOVO ID screen: that a sync runs,
 * or when the words were last synced (the time today, or the date, with the
 * year only in another year). The offline plate says there is no network,
 * so the line gives the last sync then too. While the Account's records are
 * at their limit the line says Sync stopped for it; while the Account refuses
 * this device's changes for good otherwise, the line gives the last sync and
 * marks nothing synced. Else nothing before a first sync has gone through.
 */
export function syncStatusLine({
  state,
  strings,
  months,
  clock,
}: {
  state: SyncState;
  strings: EditionStrings['account']['sync'];
  /** The short month names, as the line abbreviates them. */
  months: EditionStrings['dates']['shortMonths'];
  clock: Clock;
}): SyncStatus | undefined {
  if (state.running) return { text: strings.syncing, synced: false };
  if (state.refused === 'too-many-records') {
    return { text: strings.stoppedTooManyRecords, synced: false };
  }
  if (state.syncedAt === undefined) return undefined;
  return {
    text: lastSync(state.syncedAt, strings, months, clock),
    synced: !state.offline && state.refused === undefined,
  };
}

function lastSync(
  syncedAt: Date,
  strings: EditionStrings['account']['sync'],
  months: EditionStrings['dates']['shortMonths'],
  clock: Clock,
): string {
  const { date, daysAgo } = localDayOf(syncedAt, clock);
  if (daysAgo === 0) {
    const { hour, minute } = localTimeOf(syncedAt, clock);
    return fill(strings.syncedToday, { time: `${twoDigits(hour)}:${twoDigits(minute)}` });
  }
  const day = String(date.day);
  const month = months[date.month - 1] ?? '';
  const thisYear = localDayOf(clock.now(), clock).date.year;
  return date.year === thisYear
    ? fill(strings.syncedOn, { day, month })
    : fill(strings.syncedOnInYear, { day, month, year: String(date.year) });
}
