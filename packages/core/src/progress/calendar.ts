import {
  dateKeyOf,
  dayNumber,
  localDateAfter,
  parseLocalDate,
  type LocalDate,
} from '../local-date';

/**
 * A day of the Active Days calendar: `active` an Active Day before today,
 * `missed` a day before today that isn't one, `today`, or `future` a day still
 * to come.
 */
export type CalendarDayState = 'active' | 'missed' | 'today' | 'future';

/** A day in a month of the Active Days calendar. */
export interface CalendarDay {
  /** The local date: `YYYY-MM-DD`. */
  readonly date: string;
  /** The day of the month, from 1. */
  readonly day: number;
  readonly state: CalendarDayState;
  /** Whether the day is an Active Day, today's too, so the outlined today carries its dot. */
  readonly active: boolean;
}

/** A month of the Active Days calendar. */
export interface CalendarMonth {
  readonly year: number;
  /** 1 for January to 12 for December. */
  readonly month: number;
  /** Its weeks, Monday first, seven slots each; a slot outside the month holds no day. */
  readonly weeks: readonly (readonly (CalendarDay | undefined)[])[];
}

const DAYS_IN_WEEK = 7;

/** The month of the date counted from year 0, so months follow on from one another. */
const monthNumber = ({ year, month }: Pick<LocalDate, 'year' | 'month'>) => year * 12 + month - 1;

/** The month of the Active Days calendar, with each day's state on the local date `today`. */
function monthOf(
  year: number,
  month: number,
  activeDays: ReadonlySet<string>,
  today: number,
): CalendarMonth {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay counts from Sunday; the calendar's weeks start on Monday.
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % DAYS_IN_WEEK;
  const slots: (CalendarDay | undefined)[] = Array.from({ length: leading }, () => undefined);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = dateKeyOf({ year, month, day });
    const number = dayNumber({ year, month, day });
    const active = activeDays.has(date);
    const state =
      number === today ? 'today' : number > today ? 'future' : active ? 'active' : 'missed';
    slots.push({ date, day, state, active });
  }
  while (slots.length % DAYS_IN_WEEK !== 0) slots.push(undefined);
  const weeks = Array.from({ length: slots.length / DAYS_IN_WEEK }, (_, week) =>
    slots.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK),
  );
  return { year, month, weeks };
}

/**
 * The months of the Active Days calendar on the local date `today`, oldest
 * first: from the month of the first Active Day to the current one, and no
 * further, so an Active Day ahead of a clock moved back shows no month of its own.
 */
export function calendarMonths(
  activeDays: ReadonlySet<string>,
  today: string,
): readonly CalendarMonth[] {
  const todayDate = parseLocalDate(today);
  const todayNumber = dayNumber(todayDate);
  const firstNumber = Math.min(
    todayNumber,
    ...[...activeDays].map((date) => dayNumber(parseLocalDate(date))).filter(Number.isFinite),
  );
  const months: CalendarMonth[] = [];
  const first = monthNumber(localDateAfter(todayDate, firstNumber - todayNumber));
  for (let number = first; number <= monthNumber(todayDate); number += 1) {
    months.push(monthOf(Math.floor(number / 12), (number % 12) + 1, activeDays, todayNumber));
  }
  return months;
}
