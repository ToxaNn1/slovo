import type { CrosswordDay } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checksumOf, type ContentManifest } from './content-manifest';
import { CROSSWORD_DAYS_FILE } from './edition-folder';

/** How many days ahead of the day it is recorded on the Daily Crossword reaches (ADR 0052). */
export const CROSSWORD_DAYS_AHEAD = 400;

/**
 * How many days apart a word may come back in the Daily Crossword, at the
 * least: a margin under the 24 days with which the UA Edition's
 * 3–5-letter words just fill the 400 days ahead (ADR 0052).
 */
export const CROSSWORD_REPEAT_DAYS = 20;

/** The date `days` after `date`, both `YYYY-MM-DD`. */
export function dateAfter(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The checksum of the crossword days, which the manifest records with the content. */
export function crosswordDaysChecksum(days: readonly CrosswordDay[]): string {
  return checksumOf(days);
}

/**
 * What the rules of ADR 0052 refuse in an Edition's crossword days: days
 * other than those last recorded, days with no checksum recorded among them,
 * since a published day never changes and only the build appends; a gap
 * between days; and a word that comes back within 20 days.
 */
export function crosswordDayErrors(
  days: readonly CrosswordDay[] | undefined,
  manifest: ContentManifest | undefined,
  editionId: string | undefined,
): BuildError[] {
  const recorded = manifest?.crosswordDaysChecksum;
  const unrecorded =
    recorded === undefined
      ? days !== undefined && days.length > 0
      : days === undefined || crosswordDaysChecksum(days) !== recorded;
  const checksumErrors: BuildError[] = unrecorded
    ? [
        {
          file: CROSSWORD_DAYS_FILE,
          message: `Not the days last recorded: a published day never changes and only pnpm build:pack ${editionId ?? '<edition-id>'} --record appends days, so restore the file from git`,
        },
      ]
    : [];
  return [...checksumErrors, ...ruleErrors(days ?? [])];
}

/** A gap between days, and a word that comes back within 20 days. */
function ruleErrors(days: readonly CrosswordDay[]): BuildError[] {
  return days.flatMap((day, i) => {
    const before = days[i - 1];
    if (before !== undefined && day.date !== dateAfter(before.date, 1)) {
      return [
        {
          file: CROSSWORD_DAYS_FILE,
          field: `${String(i)}.date`,
          message: `Expected ${dateAfter(before.date, 1)}, the day after the one before: the days run without a gap`,
        },
      ];
    }
    const since = dateAfter(day.date, 1 - CROSSWORD_REPEAT_DAYS);
    const recent = days.slice(0, i).filter((other) => other.date >= since);
    return day.words.flatMap(({ entryId }, word) => {
      const earlier = recent.find(({ words }) => words.some((other) => other.entryId === entryId));
      return earlier === undefined
        ? []
        : [
            {
              file: CROSSWORD_DAYS_FILE,
              field: `${String(i)}.words.${String(word)}.entryId`,
              message: `${entryId} is also in the day of ${earlier.date}: a word comes back only ${String(CROSSWORD_REPEAT_DAYS)} days or more later`,
            },
          ];
    });
  });
}
