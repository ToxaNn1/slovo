import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import type { KnownCounts, ShownKind } from '@slovo/core';

/**
 * The row of the Known Entries of the stats sheet: the Known count of each
 * kind of Entry in `kinds`, in that order, each in the plural form `count`
 * picks, e.g. «Знаю 120 слів · 12 Виправлень · 8 фразеологізмів».
 */
export function knownLine(
  strings: Pick<EditionStrings['stats'], 'known' | 'knownJoiner' | 'knownByKind'>,
  known: KnownCounts,
  kinds: readonly ShownKind[],
  count: (forms: Plural, count: number) => string,
): string {
  return fill(strings.known, {
    counts: kinds
      .map((kind) => count(strings.knownByKind[kind], known[kind]))
      .join(strings.knownJoiner),
  });
}
