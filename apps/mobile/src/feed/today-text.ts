import { fill, type EditionStrings } from '@slovo/contracts';
import type { LocalDate } from '@slovo/core';

/** A local day as the Feed's header says it: «пн, 2 листопада». */
export function todayText(
  { year, month, day }: LocalDate,
  { feed, dates }: Pick<EditionStrings, 'feed' | 'dates'>,
): string {
  // getUTCDay counts from Sunday; the weekday names start on Monday.
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return fill(feed.today, {
    weekday: dates.weekdays[weekday] ?? '',
    day: String(day),
    month: dates.months[month - 1] ?? '',
  });
}
