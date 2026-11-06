import { dateKeyOf, dayNumber, localDateAfter, parseLocalDate } from '../local-date';

/**
 * A day of the Active Days calendar: an Active Day before today, a `missed`
 * day before today that isn't one, a day a Streak freeze covered, a day of a
 * Break, ahead of today too, today, outlined, with its dot once it is an
 * Active Day, or a day still to come.
 */
export type CalendarDay = {
  /** The local date: `YYYY-MM-DD`. */
  readonly date: string;
  /** The day of the month, from 1. */
  readonly day: number;
  /** 1 for January to 12 for December. */
  readonly month: number;
} & (
  | { readonly state: 'active' | 'missed' | 'frozen' | 'break' | 'future' }
  | { readonly state: 'today'; readonly active: boolean }
);

/** The state of a day of the Active Days calendar. */
export type CalendarDayState = CalendarDay['state'];

/** A week of the Active Days calendar: its seven days, Monday first. */
export type CalendarWeek = readonly CalendarDay[];

const DAYS_IN_WEEK = 7;
/** The weeks of the calendar: 35 days (ADR 0085). */
const WEEKS = 5;

/** The records the calendar's days are read from, on the local date `today`. */
interface CalendarRecords {
  activeDays: ReadonlySet<string>;
  frozen: ReadonlySet<string>;
  /** The Breaks started: the length in days by the local date each starts on. */
  breaks: ReadonlyMap<string, number>;
  today: string;
}

/**
 * The days of the calendar from `first` days after today, `count` of them, by
 * the records; a Break day reads as one before every state but today's.
 */
function calendarDays(
  { activeDays, frozen, breaks, today }: CalendarRecords,
  first: number,
  count: number,
): CalendarDay[] {
  const todayDate = parseLocalDate(today);
  const todayNumber = dayNumber(todayDate);
  const paused = new Set<number>();
  for (const [start, days] of breaks) {
    const from = dayNumber(parseLocalDate(start));
    for (let day = from; day < from + days; day += 1) paused.add(day);
  }
  return Array.from({ length: count }, (_, slot): CalendarDay => {
    const number = todayNumber + first + slot;
    const local = localDateAfter(todayDate, first + slot);
    const date = dateKeyOf(local);
    const shown = { date, day: local.day, month: local.month };
    if (number === todayNumber) return { ...shown, state: 'today', active: activeDays.has(date) };
    if (paused.has(number)) return { ...shown, state: 'break' };
    if (number > todayNumber) return { ...shown, state: 'future' };
    if (activeDays.has(date)) return { ...shown, state: 'active' };
    return { ...shown, state: frozen.has(date) ? 'frozen' : 'missed' };
  });
}

/**
 * The Active Days calendar on the local date `today`: the 35 days ending
 * with the Sunday of today's week, in five weeks, Monday first, across
 * months (ADR 0085). The Break and frozen days come from the XP log's
 * records; a Break day reads as one before every state but today's.
 */
export function calendarWeeks(records: CalendarRecords): readonly CalendarWeek[] {
  const todayNumber = dayNumber(parseLocalDate(records.today));
  // dayNumber counts from Thursday 1970-01-01; the calendar's weeks start on Monday.
  const weekday = (((todayNumber + 3) % DAYS_IN_WEEK) + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const days = calendarDays(records, -weekday - (WEEKS - 1) * DAYS_IN_WEEK, WEEKS * DAYS_IN_WEEK);
  return Array.from({ length: WEEKS }, (_, week) =>
    days.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK),
  );
}

/**
 * The 7 days ending with today, as the Streak freeze card shows them, in the
 * calendar's states (ADR 0085).
 */
export function lastWeek(records: CalendarRecords): readonly CalendarDay[] {
  return calendarDays(records, 1 - DAYS_IN_WEEK, DAYS_IN_WEEK);
}
