import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import {
  formatTimeOfDay,
  localDayOf,
  type Clock,
  type HistoryEntry,
  type LocalDate,
  type LocalDay,
  type RelativeTime,
} from '@slovo/core';
import { entryLabel } from '@slovo/ui/entry-row-text';

/** A time as a row says it, on screen and as VoiceOver reads it. */
export interface RelativeText {
  readonly text: string;
  readonly spoken: string;
}

/**
 * The words of History, from the Edition's strings: the label of an Entry, the
 * heading of a day and how long ago an Entry was Seen. The Core decides which
 * day and which time; this only says them in the Edition's language, so the
 * clock's time zone still decides the day.
 */
export function historyText({
  strings,
  count,
  clock,
}: {
  strings: EditionStrings['history'];
  count: (forms: Plural, count: number) => string;
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
      return dateText(date, strings.days.months, strings.days);
    },

    /**
     * What VoiceOver reads for the Saved card: the name and the count in full,
     * then each latest row with how long ago it was Seen in full words.
     */
    cardLabel(total: number, rows: readonly { title: string; spoken: string }[]): string {
      return [
        fill(strings.cardLabel, { count: count(strings.count, total) }),
        ...rows.map(({ title, spoken }) => `${title}, ${spoken}`),
      ].join('. ');
    },

    /** «щойно», «5 хв тому», «сьогодні, 09:02»; VoiceOver gets «5 хвилин тому» in full. */
    relative(time: RelativeTime): RelativeText {
      const { relative } = strings;
      if (time.kind === 'now') return { text: relative.now, spoken: relative.now };
      if (time.kind === 'minutes') {
        return {
          text: count(relative.minutesAgo, time.minutes),
          spoken: count(relative.minutesAgoSpoken, time.minutes),
        };
      }
      const clockTime = formatTimeOfDay(time);
      if (time.kind === 'today' || time.kind === 'yesterday') {
        const said = fill(relative[time.kind], { time: clockTime });
        return { text: said, spoken: said };
      }
      // The screen abbreviates the month; VoiceOver gets it whole.
      const on = (months: readonly string[]) =>
        dateText(time.date, months, relative, { time: clockTime });
      return { text: on(relative.months), spoken: on(strings.days.months) };
    },
  };
}
