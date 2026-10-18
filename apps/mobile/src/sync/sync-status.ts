import { fill, type EditionStrings } from '@slovo/contracts';
import { localDayOf, localTimeOf, type Clock, type SyncState } from '@slovo/core';

const twoDigits = (value: number) => String(value).padStart(2, '0');

/**
 * The status line under the email of the SLOVO ID screen: that a sync runs,
 * that it waits for the network, or when the words were last synced (the time
 * today, or the date, with the year only in another year). Nothing before a
 * first sync has gone through.
 */
export function syncStatusLine({
  state,
  strings,
  clock,
}: {
  state: SyncState;
  strings: EditionStrings['account']['sync'];
  clock: Clock;
}): string | undefined {
  if (state.running) return strings.syncing;
  if (state.offline) return strings.waitingForNetwork;
  if (state.syncedAt === undefined) return undefined;
  const { date, daysAgo } = localDayOf(state.syncedAt, clock);
  if (daysAgo === 0) {
    const { hour, minute } = localTimeOf(state.syncedAt, clock);
    return fill(strings.syncedToday, { time: `${twoDigits(hour)}:${twoDigits(minute)}` });
  }
  const day = String(date.day);
  const month = strings.months[date.month - 1] ?? '';
  const thisYear = localDayOf(clock.now(), clock).date.year;
  return date.year === thisYear
    ? fill(strings.syncedOn, { day, month })
    : fill(strings.syncedOnInYear, { day, month, year: String(date.year) });
}
