import { fill, type EditionStrings } from '@slovo/contracts';
import {
  localDayOf,
  type Clock,
  type HistoryEntry,
  type LocalDate,
  type LocalDay,
} from '@slovo/core';
import { entryLabel } from '@slovo/ui/entry-row-text';

/**
 * The words of History, from the Edition's strings: the label of an Entry and
 * the heading of a day. The Core decides which day; this only says it in the
 * Edition's language, so the clock's time zone still decides the day.
 */
export function historyText({
  strings,
  dates,
  clock,
}: {
  strings: EditionStrings['history'];
  dates: EditionStrings['dates'];
  clock: Clock;
}) {
  const thisYear = () => localDayOf(clock.now(), clock).date.year;
  /** A date as a template takes it: the one without the year in this year, the other in another. */
  const dateText = (
    date: LocalDate,
    months: readonly string[],
    templates: { readonly date: string; readonly dateInYear: string },
    extra: Readonly<Record<string, string>> = {},
  ) =>
    fill(date.year === thisYear() ? templates.date : templates.dateInYear, {
      ...extra,
      day: String(date.day),
      month: months[date.month - 1] ?? '',
      year: String(date.year),
    });

  return {
    /** «слово», «виправлення», «фразеологізм», «топонім» or «слово дня». */
    label({ row, wordOfTheDay }: Pick<HistoryEntry, 'row' | 'wordOfTheDay'>): string {
      return wordOfTheDay ? strings.kinds.wordOfTheDay : entryLabel(strings.kinds, row);
    },

    /** «Сьогодні», «Учора» or the date, with the year only for another year. */
    dayHeading({ date, daysAgo }: LocalDay): string {
      if (daysAgo <= 0) return strings.days.today;
      if (daysAgo === 1) return strings.days.yesterday;
      return dateText(date, dates.months, strings.days);
    },
  };
}
