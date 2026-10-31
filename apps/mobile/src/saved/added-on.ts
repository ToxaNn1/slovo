import { localDayOf } from '@slovo/core';
import { fill } from '@slovo/ui';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';

const { added } = editionStrings.favorites;
const { shortMonths } = editionStrings.dates;

/**
 * When an Entry was added to Favorites or to a Collection, as its row says it:
 * today, yesterday or the date, by the device's clock.
 */
export function addedOn(addedAt: Date): string {
  const { date, daysAgo } = localDayOf(addedAt, deviceClock);
  if (daysAgo <= 0) return added.today;
  if (daysAgo === 1) return added.yesterday;
  const thisYear = localDayOf(deviceClock.now(), deviceClock).date.year;
  return fill(date.year === thisYear ? added.date : added.dateInYear, {
    day: String(date.day),
    month: shortMonths[date.month - 1] ?? '',
    year: String(date.year),
  });
}
