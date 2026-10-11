import type { Clock } from './ports';

/** A local calendar day. */
export interface LocalDate {
  readonly year: number;
  /** 1 for January to 12 for December. */
  readonly month: number;
  readonly day: number;
}

/** Today's local calendar date in the clock's time zone, as `YYYY-MM-DD`. */
export function localDate(clock: Clock): string {
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
