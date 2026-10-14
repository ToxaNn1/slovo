import type { Clock } from './ports';

/** A local calendar day. */
export interface LocalDate {
  readonly year: number;
  /** 1 for January to 12 for December. */
  readonly month: number;
  readonly day: number;
}

/** The parts of an instant as the time zone writes it, each read by its type. */
function partsAt(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = new Intl.DateTimeFormat('en-US', { ...options, timeZone }).formatToParts(instant);
  return (type) => parts.find((candidate) => candidate.type === type)?.value ?? '';
}

/** The key of today's local calendar date in the clock's time zone: `YYYY-MM-DD`. */
export function todayKey(clock: Clock): string {
  const part = partsAt(clock.now(), clock.timeZone(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
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
export const dayNumber = ({ year, month, day }: LocalDate) =>
  Date.UTC(year, month - 1, day) / DAY_MS;

/** The key of the local date `days` after the date of the key `date`, both `YYYY-MM-DD`. */
export function dateKeyAfter(date: string, days: number): string {
  return new Date((dayNumber(parseLocalDate(date)) + days) * DAY_MS).toISOString().slice(0, 10);
}

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

/** The wall-clock time of an instant in the clock's current time zone, on a 24-hour clock. */
export function localTimeOf(
  instant: Date,
  clock: Clock,
): { readonly hour: number; readonly minute: number } {
  const part = partsAt(instant, clock.timeZone(), {
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { hour: Number(part('hour')), minute: Number(part('minute')) };
}

/** The wall-clock time of an instant in the time zone, counted in milliseconds as if it were UTC. */
function wallClockAt(instant: number, timeZone: string): number {
  const text = partsAt(new Date(instant), timeZone, {
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(text(type));
  const milliseconds = ((instant % 1000) + 1000) % 1000;
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
    milliseconds,
  );
}

/**
 * The milliseconds from now until the next local day starts in the clock's
 * time zone, across a daylight-saving change too, so a timer can tell the
 * composition when today ends.
 */
export function untilNextLocalDay(clock: Clock): number {
  const zone = clock.timeZone();
  const now = clock.now().getTime();
  const wallClock = wallClockAt(now, zone);
  const nextMidnight = (Math.floor(wallClock / DAY_MS) + 1) * DAY_MS;
  // Midnight at today's offset from UTC, then at the offset in force by then.
  const atTodaysOffset = now + nextMidnight - wallClock;
  const atItsOffset = nextMidnight - (wallClockAt(atTodaysOffset, zone) - atTodaysOffset);
  // When a daylight-saving change skips midnight, the day starts at the change.
  const start = wallClockAt(atItsOffset, zone) >= nextMidnight ? atItsOffset : atTodaysOffset;
  return start - now;
}
