import {
  WEEKDAYS,
  type Holiday,
  type HolidayRule,
  type SeasonalMotif,
  type SeasonMotifs,
} from '@slovo/contracts';

import type { LocalDate } from '../local-date';
import { seasonOf } from './season';

/** The weekday of a local date, as its index in `WEEKDAYS` (0 for Monday). */
function weekdayIndexOf({ year, month, day }: LocalDate): number {
  // `getUTCDay` counts from Sunday.
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function falls(rule: HolidayRule, date: LocalDate): boolean {
  if (rule.month !== date.month) return false;
  if (rule.kind === 'fixed') return rule.day === date.day;
  const weekdayOfFirst = weekdayIndexOf({ ...date, day: 1 });
  const firstDay = 1 + ((WEEKDAYS.indexOf(rule.weekday) - weekdayOfFirst + 7) % 7);
  return date.day === firstDay + (rule.nth - 1) * 7;
}

/**
 * The Holiday of a local date by the Edition's rules, or `undefined` on an
 * ordinary day (ADR 0055). It follows the local date alone, so it changes at
 * local midnight.
 */
export function holidayOf(date: LocalDate, holidays: readonly Holiday[]): Holiday | undefined {
  return holidays.find(({ rule }) => falls(rule, date));
}

/** The Edition's seasonal motifs: one per Season and one with each Holiday. */
export interface SeasonalMotifs {
  readonly seasons: SeasonMotifs;
  readonly holidays: readonly Holiday[];
}

/** The motif of a local date: its Holiday's if it has one, else its Season's (ADR 0055). */
export function motifOf(date: LocalDate, { seasons, holidays }: SeasonalMotifs): SeasonalMotif {
  return holidayOf(date, holidays)?.motif ?? seasons[seasonOf(date)];
}
