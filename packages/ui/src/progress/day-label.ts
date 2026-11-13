import { fill, type EditionStrings } from '@slovo/contracts';
import type { CalendarDay } from '@slovo/core';

type Strings = Pick<EditionStrings, 'dates'> & { stats: Pick<EditionStrings['stats'], 'calendar'> };

/** A day's `{day}` and `{month}` placeholders: its number and its month's name in the Edition's words. */
export function dayDate(
  strings: Pick<EditionStrings, 'dates'>,
  day: Pick<CalendarDay, 'day' | 'month'>,
) {
  return { day: String(day.day), month: strings.dates.months[day.month - 1] ?? '' };
}

/** How VoiceOver reads a day of the calendar: its date and its state, today's with whether it is active. */
export function dayLabel(strings: Strings, day: CalendarDay): string {
  const spoken = day.state === 'today' ? (day.active ? 'todayActive' : 'today') : day.state;
  return fill(strings.stats.calendar.days[spoken], dayDate(strings, day));
}
