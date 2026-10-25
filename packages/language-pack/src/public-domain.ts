import type { Correction } from '@slovo/contracts';

import type { BuildError } from './build-error';
import type { Authored } from './check-content';

/**
 * The literary uses whose texts are not yet in the public domain on `today`.
 * Under Ukrainian law a text stays protected for 70 years after its author's
 * death, counted from 1 January of the next year, so it enters the public
 * domain on 1 January of the 71st year after the death (ADR 0045).
 */
export function protectedLiteraryUses(
  corrections: readonly Authored<Correction>[],
  today: Date,
): BuildError[] {
  return corrections.flatMap(({ file, entry }) =>
    entry.literaryUses.flatMap(({ authorDeathYear }, index) => {
      const freeFrom = authorDeathYear + 71;
      if (today.getFullYear() >= freeFrom) return [];
      return [
        {
          file,
          entryId: entry.id,
          field: `literaryUses.${String(index)}.authorDeathYear`,
          message: `Not in the public domain until 1 January ${String(freeFrom)}`,
        },
      ];
    }),
  );
}
