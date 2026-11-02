import { fill, type EditionStrings } from '@slovo/contracts';
import { todayDate, type Clock } from '@slovo/core';

/** Today as the Feed's header says it, in the reader's time zone: «пн, 2 листопада». */
export function todayText(
  clock: Clock,
  { feed, dates }: Pick<EditionStrings, 'feed' | 'dates'>,
): string {
  const { year, month, day } = todayDate(clock);
  // getUTCDay counts from Sunday; the weekday names start on Monday.
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return fill(feed.today, {
    weekday: dates.weekdays[weekday] ?? '',
    day: String(day),
    month: dates.months[month - 1] ?? '',
  });
}
