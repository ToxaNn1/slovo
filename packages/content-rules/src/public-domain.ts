import type { Correction } from '@slovo/contracts';

import type { Authored, Refusal } from './refusal';

/** The year of the Edition's day of `at`: the Edition counts its days in Kyiv. */
const editionYearOf = (at: Date): number =>
  Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv', year: 'numeric' }).format(at));

/**
 * The literary uses whose texts are not yet in the public domain on `today`.
 * Under Ukrainian law a text stays protected for 70 years after its author's
 * death, counted from 1 January of the next year, so it enters the public
 * domain on 1 January of the 71st year after the death, the Edition's day in
 * Kyiv, whatever the host's time zone.
 */
export function protectedLiteraryUses(
  corrections: readonly Authored<Correction>[],
  today: Date,
): Refusal[] {
  return corrections.flatMap(({ file, entry }) =>
    entry.literaryUses.flatMap(({ authorDeathYear }, index) => {
      const freeFrom = authorDeathYear + 71;
      if (editionYearOf(today) >= freeFrom) return [];
      return [
        {
          rule: 'public-domain' as const,
          file,
          entryId: entry.id,
          field: `literaryUses.${String(index)}.authorDeathYear`,
          message: `Not in the public domain until 1 January ${String(freeFrom)}`,
        },
      ];
    }),
  );
}
