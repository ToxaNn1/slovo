import type { Correction, Entry, Word } from '@slovo/contracts';

import type { Edition } from './edition';
import type { ContentReadPort } from './ports';

/** The ids of Entries, each kind in its own list. */
export interface EntryIds {
  readonly words: readonly string[];
  readonly corrections: readonly string[];
}

/**
 * The Entries of the Language Pack as this Edition and this user may see
 * them. It is the only module that decides which Entries are eligible, so
 * the Feed, the Cycle, the Word of the Day and the card builders never check
 * Retired or a Feature Switch themselves. An eligible Entry is live (not
 * Retired) and of a kind the Edition turns on; 0.3 adds the Mix and Hidden
 * Entries here (ADR 0015).
 */
export interface Entries {
  /**
   * The ids of the eligible Entries, each kind in the Language Pack's stable
   * order: the live Words, and the live Corrections when the Edition turns
   * Corrections on. Read afresh on every call.
   */
  eligible(): Promise<EntryIds>;
  /**
   * Any Entry by id, eligible or not: a Retired one, or a Correction when the
   * Edition turns Corrections off. So the Entries the user keeps stay
   * reachable.
   */
  get(id: string): Promise<Entry | undefined>;
  /**
   * The live Corrections the Word is the standard form for, in the order the
   * Word links them, or none when the Edition turns Corrections off. A
   * Correction missing from the Language Pack is skipped.
   */
  linkedCorrections(word: Word): Promise<Correction[]>;
  /** The live Words that are the standard form for the Correction, in a stable order. */
  linkedWords(correction: Correction): Promise<Word[]>;
}

export function createEntries({
  content,
  edition,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'isFeatureEnabled'>;
}): Entries {
  const withCorrections = () => edition.isFeatureEnabled('corrections');

  return {
    async eligible() {
      const [words, corrections] = await Promise.all([
        content.listWordIds(),
        withCorrections() ? content.listCorrectionIds() : [],
      ]);
      return { words, corrections };
    },
    async get(id) {
      return (await content.getWord(id)) ?? content.getCorrection(id);
    },
    async linkedCorrections(word) {
      if (!withCorrections()) return [];
      const corrections = await Promise.all(
        word.correctionIds.map((id) => content.getCorrection(id)),
      );
      return corrections.filter(
        (correction): correction is Correction => correction?.retired === false,
      );
    },
    async linkedWords(correction) {
      const ids = await content.listLinkedWordIds(correction.id);
      const words = await Promise.all(ids.map((id) => content.getWord(id)));
      return words.filter((word) => word !== undefined);
    },
  };
}
