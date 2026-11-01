import { fill } from '@slovo/contracts';
import { parseLocalDate } from '@slovo/core';

import { editionStrings } from '../edition/edition';

/** A local date `YYYY-MM-DD` as the progress screens say it, as a progress Share Card's overline does: «20 жовтня». */
export function dayText(date: string): string {
  const { day, month } = parseLocalDate(date);
  return fill(editionStrings.share.day, {
    day: String(day),
    month: editionStrings.dates.months[month - 1] ?? '',
  });
}
