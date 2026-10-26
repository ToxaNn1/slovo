import type { Category, Correction, Idiom, SynonymRow, Word } from '@slovo/contracts';

import type { ContentReadPort } from '../ports';

/**
 * A content read port over Entries held in memory, for tests. It lists them
 * in the order given, and holds to the same contract as the pack reader.
 * Without `categories` it lists the Categories of the Words, in the order
 * they first appear, each named by its id, so every Word has its Category as
 * in a pack. Without `correctionCategories` it lists those of the
 * Corrections the same way.
 */
export function createMemoryContentPort({
  categories,
  correctionCategories,
  words = [],
  corrections = [],
  idioms = [],
  synonymRows = [],
}: {
  categories?: readonly Category[];
  correctionCategories?: readonly Category[];
  words?: readonly Word[];
  corrections?: readonly Correction[];
  idioms?: readonly Idiom[];
  synonymRows?: readonly SynonymRow[];
} = {}): ContentReadPort {
  const liveWords = words.filter((word) => !word.retired);
  const entries = [...words, ...corrections, ...idioms, ...synonymRows];
  const categoriesOf = (entries: readonly (Word | Correction)[]) =>
    [...new Set(entries.map((entry) => entry.categoryId))].map((id) => ({ id, displayName: id }));
  const packCategories = categories ?? categoriesOf(words);
  const packCorrectionCategories = correctionCategories ?? categoriesOf(corrections);
  return {
    listCategories: () => Promise.resolve(packCategories),
    listCorrectionCategories: () => Promise.resolve(packCorrectionCategories),
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
    listLinkingSynonymRowIds: (wordId) =>
      Promise.resolve(
        liveWords.some((word) => word.id === wordId)
          ? synonymRows
              .filter(
                (row) => !row.retired && row.members.some((member) => member.wordId === wordId),
              )
              .map((row) => row.id)
          : [],
      ),
  };
}
