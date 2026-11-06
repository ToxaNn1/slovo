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

/** What a day of the calendar is drawn from: the XP log's days and today. */
interface CalendarDays {
  activeDays: ReadonlySet<string>;
  frozen: ReadonlySet<string>;
  /** The Breaks started: the length in days by the local date each starts on. */
  breaks: ReadonlyMap<string, number>;
  /** The local date `YYYY-MM-DD` of today. */
  today: string;
}

/**
 * The state of each day by its day number: today first in the calendar, a
 * Break day first in the Break's strip, where today is one of its days.
 */
function dayOf({ activeDays, frozen, breaks, today }: CalendarDays, first: 'today' | 'break') {
  const todayDate = parseLocalDate(today);
  const todayNumber = dayNumber(todayDate);
  const paused = new Set<number>();
  for (const [start, days] of breaks) {
    const firstDay = dayNumber(parseLocalDate(start));
    for (let day = firstDay; day < firstDay + days; day += 1) paused.add(day);
  }
  return (number: number): CalendarDay => {
    const local = localDateAfter(todayDate, number - todayNumber);
    const date = dateKeyOf(local);
    const shown = { date, day: local.day, month: local.month };
    if (first === 'break' && paused.has(number)) return { ...shown, state: 'break' };
    if (number === todayNumber) return { ...shown, state: 'today', active: activeDays.has(date) };
    if (paused.has(number)) return { ...shown, state: 'break' };
    if (number > todayNumber) return { ...shown, state: 'future' };
    if (activeDays.has(date)) return { ...shown, state: 'active' };
    return { ...shown, state: frozen.has(date) ? 'frozen' : 'missed' };
  };
}

/**
 * The Active Days calendar on the local date `today`: the 35 days ending
 * with the Sunday of today's week, in five weeks, Monday first, across
 * months (ADR 0085). The Break and frozen days come from the XP log's
 * records; a Break day reads as one before every state but today's.
 */
export function calendarWeeks(days: CalendarDays): readonly CalendarWeek[] {
  const todayNumber = dayNumber(parseLocalDate(days.today));
  const day = dayOf(days, 'today');
  // dayNumber counts from Thursday 1970-01-01; the calendar's weeks start on Monday.
  const weekday = (((todayNumber + 3) % DAYS_IN_WEEK) + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const first = todayNumber - weekday - (WEEKS - 1) * DAYS_IN_WEEK;
  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: DAYS_IN_WEEK }, (_, slot) => day(first + week * DAYS_IN_WEEK + slot)),
  );
}

/** The days of the running Break's strip (board 10, p1). */
const STRIP_DAYS = 14;

/**
 * The strip of the running Break whose last day is `lastDay`: the 14 days
 * ending the day after it, so the days before it show how the Streak came
 * to it. Every day of a Break, today too, reads as a Break day.
 */
export function breakStrip({
  lastDay,
  ...days
}: CalendarDays & { lastDay: string }): CalendarDay[] {
  const end = dayNumber(parseLocalDate(lastDay)) + 1;
  const day = dayOf(days, 'break');
  return Array.from({ length: STRIP_DAYS }, (_, index) => day(end - STRIP_DAYS + 1 + index));
}

/**
 * The 7 days ending with today, as the Streak freeze card shows them, in the
 * calendar's states (ADR 0085).
 */
export function lastWeek(days: CalendarDays): readonly CalendarDay[] {
  const todayNumber = dayNumber(parseLocalDate(days.today));
  const day = dayOf(days, 'today');
  return Array.from({ length: DAYS_IN_WEEK }, (_, slot) =>
    day(todayNumber - DAYS_IN_WEEK + 1 + slot),
  );
}
