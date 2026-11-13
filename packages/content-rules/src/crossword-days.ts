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

/** A gap between days, and a word that comes back within 20 days, each on its own. */
function ruleErrors(days: readonly CrosswordDay[]): Refusal[] {
  return days.flatMap((day, i): Refusal[] => {
    const before = days[i - 1];
    const gap: Refusal[] =
      before !== undefined && day.date !== dateAfter(before.date, 1)
        ? [
            {
              rule: 'crossword-days-gap' as const,
              file: CROSSWORD_DAYS_FILE,
              field: `${String(i)}.date`,
              message: `Expected ${dateAfter(before.date, 1)}, the day after the one before: the days run without a gap`,
            },
          ]
        : [];
    const since = dateAfter(day.date, 1 - CROSSWORD_REPEAT_DAYS);
    // The days run in date order, one a day, so the repeat window holds at most the days just before.
    const recent = days
      .slice(Math.max(0, i - CROSSWORD_REPEAT_DAYS), i)
      .filter((other) => other.date >= since);
    const repeats = day.words.flatMap(({ entryId }, word) => {
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
    return [...gap, ...repeats];
  });
}

/**
 * What the rules refuse in one Crossword day saved among the days: a day on
 * or before `today` is published and never changes (ADR 0052), a day stands
 * next to its neighbours without a gap, a word comes back only 20 days or
 * more from another day of it, and every word is a Word or Correction of the
 * Edition. Each refusal is located at `file`, by the field within the day.
 */
export function checkCrosswordDay(
  days: readonly CrosswordDay[],
  day: CrosswordDay,
  entries: readonly Authored<Entry>[],
  { file, today }: { file: string; today: string },
): Refusal[] {
  if (day.date <= today) {
    return [
      {
        rule: 'crossword-days-immutable',
        file,
        field: 'date',
        message: `The day of ${day.date} is published: a day on or before today never changes`,
      },
    ];
  }
  const others = days.filter((other) => other.date !== day.date);
  const before = others.filter((other) => other.date < day.date).at(-1);
  const after = others.find((other) => other.date > day.date);
  const gaps: Refusal[] = [
    ...(before !== undefined && dateAfter(before.date, 1) !== day.date
      ? [`Expected ${dateAfter(before.date, 1)}, the day after the one before`]
      : []),
    ...(after !== undefined && dateAfter(day.date, 1) !== after.date
      ? [`Expected ${dateAfter(after.date, -1)}, the day before the one after`]
      : []),
  ].map((message) => ({
    rule: 'crossword-days-gap' as const,
    file,
    field: 'date',
    message: `${message}: the days run without a gap`,
  }));
  const ids = new Set(entries.map(({ entry }) => entry.id));
  const words = day.words.flatMap(({ entryId }, word): Refusal[] => {
    const field = `words.${String(word)}.entryId`;
    if (!ids.has(entryId)) {
      return [
        {
          rule: 'crossword-day-entry',
          file,
          field,
          message: `No Word or Correction ${entryId} in the Edition`,
        },
      ];
    }
    const near = others.find(
      (other) =>
        other.date > dateAfter(day.date, -CROSSWORD_REPEAT_DAYS) &&
        other.date < dateAfter(day.date, CROSSWORD_REPEAT_DAYS) &&
        other.words.some((each) => each.entryId === entryId),
    );
    return near === undefined
      ? []
      : [
          {
            rule: 'crossword-days-repeat',
            file,
            field,
            message: `${entryId} is also in the day of ${near.date}: a word comes back only ${String(CROSSWORD_REPEAT_DAYS)} days or more apart`,
          },
        ];
  });
  return [...gaps, ...words];
}
