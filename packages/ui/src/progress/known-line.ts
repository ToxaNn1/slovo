import { fill, type EditionStrings, type EntryKind, type Plural } from '@slovo/contracts';
import type { KnownCounts } from '@slovo/core';

/**
 * The row of the Known Entries of the stats sheet: the Known count of each
 * kind of Entry in `kinds`, in that order, each in the plural form `count`
 * picks, e.g. «знаю 120 слів · 12 виправлень · 8 фразеологізмів · 3 поради».
 */
export function knownLine(
  strings: Pick<EditionStrings['stats'], 'known' | 'knownJoiner' | 'knownByKind'>,
  known: KnownCounts,
  kinds: readonly EntryKind[],
  count: (forms: Plural, count: number) => string,
): string {
  return fill(strings.known, {
    counts: kinds
      .map((kind) => count(strings.knownByKind[kind], known[kind]))
      .join(strings.knownJoiner),
  });
}
