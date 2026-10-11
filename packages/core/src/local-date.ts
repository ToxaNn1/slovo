import type { Clock } from './ports';

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
