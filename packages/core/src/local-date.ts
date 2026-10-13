import type { Clock } from './ports';

/** A local calendar day. */
export interface LocalDate {
  readonly year: number;
  /** 1 for January to 12 for December. */
  readonly month: number;
  readonly day: number;
}

/** The key of today's local calendar date in the clock's time zone: `YYYY-MM-DD`. */
export function todayKey(clock: Clock): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: clock.timeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(clock.now());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The day of a `YYYY-MM-DD` date. */
export function parseLocalDate(date: string): LocalDate {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  return { year, month, day };
}

/** The local calendar day an instant fell on, and how many local days before today that is. */
export interface LocalDay {
  readonly date: LocalDate;
  /** 0 for today, 1 for yesterday, and so on. */
  readonly daysAgo: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The local date of an instant in the time zone. */
function localDateAt(instant: Date, timeZone: string): LocalDate {
  return parseLocalDate(todayKey({ now: () => instant, timeZone: () => timeZone }));
}

/** The days from 1970-01-01 to the date, counted on the calendar alone. */
const dayNumber = ({ year, month, day }: LocalDate) => Date.UTC(year, month - 1, day) / DAY_MS;

/**
 * The local day an instant fell on, in the clock's current time zone, and how
 * many local days before today it is, so a list can say "today", "yesterday"
 * or the date.
 */
export function localDayOf(instant: Date, clock: Clock): LocalDay {
  const zone = clock.timeZone();
  const date = localDateAt(instant, zone);
  return { date, daysAgo: dayNumber(localDateAt(clock.now(), zone)) - dayNumber(date) };
}
