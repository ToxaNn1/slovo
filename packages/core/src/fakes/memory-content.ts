import type { Category, Correction, Idiom, Word } from '@slovo/contracts';

import type { ContentReadPort } from '../ports';

/**
 * A content read port over Entries held in memory, for tests. It lists them
 * in the order given, and holds to the same contract as the pack reader.
 * Without `categories` it lists the Categories of the Words, in the order
 * they first appear, each named by its id, so every Word has its Category as
 * in a pack.
 */
export function createMemoryContentPort({
  categories,
  words = [],
  corrections = [],
  idioms = [],
}: {
  categories?: readonly Category[];
  words?: readonly Word[];
  corrections?: readonly Correction[];
  idioms?: readonly Idiom[];
} = {}): ContentReadPort {
  const liveWords = words.filter((word) => !word.retired);
  const entries = [...words, ...corrections, ...idioms];
  const packCategories =
    categories ??
    [...new Set(words.map((word) => word.categoryId))].map((id) => ({ id, displayName: id }));
  return {
    listCategories: () => Promise.resolve(packCategories),
    listWordIds: (categoryId) =>
      Promise.resolve(
        liveWords
          .filter((word) => categoryId === undefined || word.categoryId === categoryId)
          .map((word) => word.id),
      ),
    listWords: () => Promise.resolve(liveWords),
    getEntries: (ids) => Promise.resolve(entries.filter((entry) => ids.includes(entry.id))),
    listCorrectionIds: () =>
      Promise.resolve(
        corrections.filter((correction) => !correction.retired).map((correction) => correction.id),
      ),
    listLinkedWordIds: (correctionId) =>
      Promise.resolve(
        liveWords
          .filter((word) => word.correctionIds.includes(correctionId))
          .map((word) => word.id),
      ),
    listIdiomIds: () =>
      Promise.resolve(idioms.filter((idiom) => !idiom.retired).map((idiom) => idiom.id)),
  };
}
