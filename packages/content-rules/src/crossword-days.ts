import type { CrosswordDay, Entry } from '@slovo/contracts';

import { checksumOf } from './checksum';
import type { Authored, Refusal } from './refusal';

/** The file of an Edition's crossword days, relative to the Edition folder. */
export const CROSSWORD_DAYS_FILE = 'content/crossword-days.json';

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

/**
 * What the rules of ADR 0052 refuse in an Edition's crossword days: days
 * other than those last recorded, days with no checksum recorded among them,
 * since a published day never changes and only the build appends; a gap
 * between days; and a word that comes back within 20 days.
 */
export function checkCrosswordDays(
  days: readonly CrosswordDay[] | undefined,
  recorded: string | undefined,
  editionId: string,
): Refusal[] {
  const unrecorded =
    recorded === undefined
      ? days !== undefined && days.length > 0
      : days === undefined || checksumOf(days) !== recorded;
  const checksumErrors: Refusal[] = unrecorded
    ? [
        {
          rule: 'crossword-days-immutable',
          file: CROSSWORD_DAYS_FILE,
          message: `Not the days last recorded: a published day never changes and only pnpm build:pack ${editionId} --record appends days, so restore the file from git`,
        },
      ]
    : [];
  return [...checksumErrors, ...ruleErrors(days ?? [])];
}

/**
 * The words of crossword days that no Word or Correction of the Edition
 * stands behind. A Retired one still does: its day stays as it was made.
 */
export function unknownCrosswordEntries(
  days: readonly CrosswordDay[],
  entries: readonly Authored<Entry>[],
): Refusal[] {
  const ids = new Set(entries.map(({ entry }) => entry.id));
  return days.flatMap(({ words }, day) =>
    words.flatMap(({ entryId }, word) =>
      ids.has(entryId)
        ? []
        : [
            {
              rule: 'crossword-day-entry' as const,
              file: CROSSWORD_DAYS_FILE,
              field: `${String(day)}.words.${String(word)}.entryId`,
              message: `No Word or Correction ${entryId} in the Edition`,
            },
          ],
    ),
  );
}

/** A gap between days, and a word that comes back within 20 days. */
function ruleErrors(days: readonly CrosswordDay[]): Refusal[] {
  return days.flatMap((day, i) => {
    const before = days[i - 1];
    if (before !== undefined && day.date !== dateAfter(before.date, 1)) {
      return [
        {
          rule: 'crossword-days-gap' as const,
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
              rule: 'crossword-days-repeat' as const,
              file: CROSSWORD_DAYS_FILE,
              field: `${String(i)}.words.${String(word)}.entryId`,
              message: `${entryId} is also in the day of ${earlier.date}: a word comes back only ${String(CROSSWORD_REPEAT_DAYS)} days or more later`,
            },
          ];
    });
  });
}
