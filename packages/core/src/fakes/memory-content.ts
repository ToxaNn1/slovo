import type { Correction, Word } from '@slovo/contracts';

import type { ContentReadPort } from '../ports';

/**
 * A content read port over Entries held in memory, for tests. It lists them
 * in the order given, and holds to the same contract as the pack reader.
 */
export function createMemoryContentPort({
  words = [],
  corrections = [],
}: {
  words?: readonly Word[];
  corrections?: readonly Correction[];
} = {}): ContentReadPort {
  const liveWords = words.filter((word) => !word.retired);
  return {
    listWordIds: (categoryId) =>
      Promise.resolve(
        liveWords
          .filter((word) => categoryId === undefined || word.categoryId === categoryId)
          .map((word) => word.id),
      ),
    listWords: () => Promise.resolve(liveWords),
    getWord: (id) => Promise.resolve(words.find((word) => word.id === id)),
    listCorrectionIds: () =>
      Promise.resolve(
        corrections.filter((correction) => !correction.retired).map((correction) => correction.id),
      ),
    getCorrection: (id) => Promise.resolve(corrections.find((correction) => correction.id === id)),
    listLinkedWordIds: (correctionId) =>
      Promise.resolve(
        liveWords
          .filter((word) => word.correctionIds.includes(correctionId))
          .map((word) => word.id),
      ),
  };
}
