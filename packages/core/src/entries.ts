import type { Correction, Entry, Word } from '@slovo/contracts';

import type { Edition } from './edition';
import type { ContentReadPort } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

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
 * Retired), of a kind the Edition turns on and not Hidden; 0.3 adds the Mix
 * here too (ADR 0015).
 */
export interface Entries {
  /**
   * The ids of the eligible Entries, each kind in the Language Pack's stable
   * order: the live Words, and the live Corrections when the Edition turns
   * Corrections on, leaving out every Hidden Entry. Read afresh on every
   * call.
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
}

const { hidden: hiddenRecords } = userStateRecords;

/**
 * The Entries over the Language Pack, and over the user's choices in the user
 * state when it is given. Without it no Entry is Hidden, for the tools and
 * screens that only read the Language Pack.
 */
export function createEntries({
  content,
  edition,
  userState,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState?: Pick<UserState, 'list'>;
}): Entries {
  const withCorrections = () => edition.isFeatureEnabled('corrections');

  return {
    async eligible() {
      const [words, corrections, hidden] = await Promise.all([
        content.listWordIds(),
        withCorrections() ? content.listCorrectionIds() : [],
        userState?.list(hiddenRecords) ?? new Map<string, string>(),
      ]);
      const shown = (id: string) => !hidden.has(id);
      return { words: words.filter(shown), corrections: corrections.filter(shown) };
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
  };
}
