import { kyivDateOf } from '../services/money';

/**
 * The Edition's days are Kyiv days: the UA Edition's readers live by them, as
 * the site's Слово дня does (ADR 0090).
 */
const KYIV_WALL_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** How far the Kyiv wall clock is ahead of UTC at a whole minute, in ms. */
function offsetAt(at: Date): number {
  const parts = KYIV_WALL_CLOCK.formatToParts(at);
  const part = (type: string) => Number(parts.find((found) => found.type === type)?.value ?? 0);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
  return wall - at.getTime();
}

/**
 * The moment the Edition's day `YYYY-MM-DD` starts. Kyiv changes its clock at
 * 01:00 UTC, so the offset at 00:00 UTC of the date is the one of its midnight.
 */
export function editionDayStart(date: string): Date {
  const midnightUtc = new Date(`${date}T00:00:00.000Z`);
  return new Date(midnightUtc.getTime() - offsetAt(midnightUtc));
}

/** The Edition's day `YYYY-MM-DD` of the time. */
export const editionDateOf = (at: Date): string => kyivDateOf(at);

/**
 * When a Curated Collection saved at `now` with its date appears on the rail:
 * at once for a collection published by the Edition's today, else at the
 * start of its date.
 */
export function collectionAppearance(publishedOn: string, now: Date): Date {
  return publishedOn <= editionDateOf(now) ? now : editionDayStart(publishedOn);
}
