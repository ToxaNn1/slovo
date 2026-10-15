import type { Clock } from './ports';

/** A local calendar day. */
export interface LocalDate {
  readonly year: number;
  /** 1 for January to 12 for December. */
  readonly month: number;
  readonly day: number;
}

/** A wall-clock time of day, on a 24-hour clock. */
export interface TimeOfDay {
  /** 0 to 23. */
  readonly hour: number;
  readonly minute: number;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** Formatters kept by time zone and options: building one costs far more than using it. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** The parts of an instant as the time zone writes it, each read by its type. */
function partsAt(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = formatterFor(timeZone, options).formatToParts(instant);
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

/** The key of a local date: `YYYY-MM-DD`. */
export function dateKeyOf({ year, month, day }: LocalDate): string {
  return `${String(year)}-${twoDigits(month)}-${twoDigits(day)}`;
}

/** The day of a `YYYY-MM-DD` date. */
export function parseLocalDate(date: string): LocalDate {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  return { year, month, day };
}

/** Today's local calendar date in the clock's time zone. */
export function todayDate(clock: Clock): LocalDate {
  return parseLocalDate(todayKey(clock));
}

/** A time of day as the app writes it, a Notification time too: `HH:MM`. */
export function formatTimeOfDay({ hour, minute }: TimeOfDay): string {
  return `${twoDigits(hour)}:${twoDigits(minute)}`;
}

/** The time of day of a `HH:MM` time. */
export function parseTimeOfDay(time: string): TimeOfDay {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return { hour, minute };
}

/** Less than 0 when `one` comes earlier in the day than `other`, 0 at the same time, more than 0 later. */
export const compareTimesOfDay = (one: TimeOfDay, other: TimeOfDay): number =>
  one.hour * 60 + one.minute - (other.hour * 60 + other.minute);

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

/** The local date `days` after the date. */
export function localDateAfter(date: LocalDate, days: number): LocalDate {
  const after = new Date((dayNumber(date) + days) * DAY_MS);
  return { year: after.getUTCFullYear(), month: after.getUTCMonth() + 1, day: after.getUTCDate() };
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
export function localTimeOf(instant: Date, clock: Clock): TimeOfDay {
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
 * The instant a local day starts in the time zone: the instant of its
 * wall-clock `midnight` (counted as if it were UTC), or the daylight-saving
 * change that skips it. `near` is an instant less than a day from it.
 */
function dayStartAt(midnight: number, near: number, zone: string): number {
  // Midnight at the offset from UTC in force at `near`, then at the offset in force by then.
  const atNearOffset = near + midnight - wallClockAt(near, zone);
  const atItsOffset = midnight - (wallClockAt(atNearOffset, zone) - atNearOffset);
  // When a daylight-saving change skips midnight, the day starts at the change.
  return wallClockAt(atItsOffset, zone) >= midnight ? atItsOffset : atNearOffset;
}

/** A local day as the instants, in milliseconds, it starts and the next one starts. */
export interface LocalDayBounds {
  readonly start: number;
  readonly end: number;
}

/** The local day of the instant `now` in the time zone. */
function dayBoundsAt(now: number, zone: string): LocalDayBounds {
  const midnight = Math.floor(wallClockAt(now, zone) / DAY_MS) * DAY_MS;
  return { start: dayStartAt(midnight, now, zone), end: dayStartAt(midnight + DAY_MS, now, zone) };
}

/**
 * Today's local day in the clock's time zone, across a daylight-saving change
 * too, so many instants can be checked against it cheaply.
 */
export function todayBounds(clock: Clock): LocalDayBounds {
  return dayBoundsAt(clock.now().getTime(), clock.timeZone());
}

/**
 * The milliseconds from now until the next local day starts in the clock's
 * time zone, across a daylight-saving change too, so a timer can tell the
 * composition when today ends.
 */
export function untilNextLocalDay(clock: Clock): number {
  const now = clock.now().getTime();
  return dayBoundsAt(now, clock.timeZone()).end - now;
}
