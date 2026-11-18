import { localDayOf } from '@slovo/core';
import { fill } from '@slovo/ui';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';

const { added } = editionStrings.favorites;
const { shortMonths } = editionStrings.dates;

/**
 * The day on a Saved row's chip (board 09): «сьогодні», «вчора» or the short
 * date of when the Entry was added or Seen, by the device's clock, and
 * whether it is today, which the chip marks.
 */
export function dayChip(at: Date): { readonly label: string; readonly today: boolean } {
  const { date, daysAgo } = localDayOf(at, deviceClock);
  if (daysAgo <= 0) return { label: added.today, today: true };
  if (daysAgo === 1) return { label: added.yesterday, today: false };
  const thisYear = localDayOf(deviceClock.now(), deviceClock).date.year;
  const label = fill(date.year === thisYear ? added.date : added.dateInYear, {
    day: String(date.day),
    month: shortMonths[date.month - 1] ?? '',
    year: String(date.year),
  });
  return { label, today: false };
}
