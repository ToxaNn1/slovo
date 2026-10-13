import { localDayOf, localTimeOf, type LocalDate, type LocalDay } from './local-date';
import type { Clock } from './ports';

/** The items of one local day, in the order they came. */
export interface DayGroup<T> {
  readonly day: LocalDay;
  readonly entries: readonly T[];
}

/**
 * Groups items that are already newest first under the local day each one
 * fell on, in the clock's current time zone, so a list can head each group
 * "today", "yesterday" or its date. A change of the time zone regroups them.
 */
export function groupByLocalDay<T>(
  items: readonly T[],
  instantOf: (item: T) => Date,
  clock: Clock,
): readonly DayGroup<T>[] {
  const groups: { day: LocalDay; entries: T[] }[] = [];
  for (const item of items) {
    const day = localDayOf(instantOf(item), clock);
    const last = groups.at(-1);
    if (last?.day.daysAgo === day.daysAgo) last.entries.push(item);
    else groups.push({ day, entries: [item] });
  }
  return groups;
}

/**
 * How long ago an instant was, as a row says it. Data only: the Edition's
 * strings turn it into words ("just now", "5 min ago", "today, 09:02").
 */
export type RelativeTime =
  | { readonly kind: 'now' }
  | { readonly kind: 'minutes'; readonly minutes: number }
  | { readonly kind: 'today'; readonly hour: number; readonly minute: number }
  | { readonly kind: 'yesterday'; readonly hour: number; readonly minute: number }
  | {
      readonly kind: 'date';
      readonly date: LocalDate;
      readonly hour: number;
      readonly minute: number;
    };

const MINUTE_MS = 60 * 1000;

/**
 * The relative time of an instant: "now" within the first minute (or if it is
 * ahead of the clock), the minutes ago within the first hour, then the local
 * time today or yesterday, and the date and time for any earlier day. The day
 * and the time follow the clock's current time zone.
 */
export function relativeTimeOf(instant: Date, clock: Clock): RelativeTime {
  const minutes = Math.floor((clock.now().getTime() - instant.getTime()) / MINUTE_MS);
  if (minutes < 1) return { kind: 'now' };
  if (minutes < 60) return { kind: 'minutes', minutes };
  const { date, daysAgo } = localDayOf(instant, clock);
  const time = localTimeOf(instant, clock);
  if (daysAgo <= 0) return { kind: 'today', ...time };
  if (daysAgo === 1) return { kind: 'yesterday', ...time };
  return { kind: 'date', date, ...time };
}
