import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import {
  localDayOf,
  type Clock,
  type HistoryEntry,
  type LocalDay,
  type RelativeTime,
} from '@slovo/core';

/** A time as a row says it, on screen and as VoiceOver reads it. */
export interface RelativeText {
  readonly text: string;
  readonly spoken: string;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/**
 * The words of History, from the Edition's strings: the kind of an Entry, the
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

  return {
    /** «слово», «виправлення» or «слово дня». */
    kind({ row, wordOfTheDay }: Pick<HistoryEntry, 'row' | 'wordOfTheDay'>): string {
      if (wordOfTheDay) return strings.kinds.wordOfTheDay;
      return row.kind === 'word' ? strings.kinds.word : strings.kinds.correction;
    },

    /** «Сьогодні», «Учора» or the date, with the year only for another year. */
    dayHeading({ date, daysAgo }: LocalDay): string {
      if (daysAgo <= 0) return strings.days.today;
      if (daysAgo === 1) return strings.days.yesterday;
      return fill(date.year === thisYear() ? strings.days.date : strings.days.dateInYear, {
        day: String(date.day),
        month: strings.days.months[date.month - 1] ?? '',
        year: String(date.year),
      });
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
      const clockTime = `${twoDigits(time.hour)}:${twoDigits(time.minute)}`;
      let said: string;
      if (time.kind === 'today') said = fill(relative.today, { time: clockTime });
      else if (time.kind === 'yesterday') said = fill(relative.yesterday, { time: clockTime });
      else {
        said = fill(time.date.year === thisYear() ? relative.date : relative.dateInYear, {
          day: String(time.date.day),
          month: relative.months[time.date.month - 1] ?? '',
          year: String(time.date.year),
          time: clockTime,
        });
      }
      return { text: said, spoken: said };
    },
  };
}
