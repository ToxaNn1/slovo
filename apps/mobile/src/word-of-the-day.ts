import type { LocalDate } from '@slovo/core';

import { editionStrings } from './edition';

/** The text of the Word of the Day badge for its day, in the Edition's words. */
export function wordOfTheDayLabel({ month, day }: LocalDate): string {
  const { badge, months } = editionStrings.wordOfTheDay;
  return badge.replace('{day}', String(day)).replace('{month}', months[month - 1] ?? '');
}
