import { checksumOf } from '@slovo/content-rules';
import type { CrosswordDay } from '@slovo/contracts';

export { CROSSWORD_REPEAT_DAYS, dateAfter } from '@slovo/content-rules';

/** How many days ahead of the day it is recorded on the Daily Crossword reaches (ADR 0052). */
export const CROSSWORD_DAYS_AHEAD = 400;

/** The checksum of the crossword days, which the manifest records with the content. */
export function crosswordDaysChecksum(days: readonly CrosswordDay[]): string {
  return checksumOf(days);
}
