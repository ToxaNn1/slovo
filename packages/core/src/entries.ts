import type { Correction, Entry, Word } from '@slovo/contracts';

import type { Edition } from './edition';
import { readMix, type MixEdition } from './mix';
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
 * Retired, a Feature Switch or the Mix themselves. An eligible Entry is live
 * (not Retired), of a kind the Edition turns on, in the user's Mix and not
 * Hidden (ADR 0015, 0019).
 */
export interface Entries {
  /**
   * The ids of the eligible Entries: the live Words of the Categories in the
   * Mix, Category by Category in the Edition's order, and the live
   * Corrections when the Edition turns Corrections on and they are in the
   * Mix, each in the Language Pack's stable order, leaving out every Hidden
   * Entry. Read afresh on every call.
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

const { hiddenEntries: hiddenRecords } = userStateRecords;

/**
 * The Entries over the Language Pack, and over the user's choices in the user
 * state when it is given. Without it there is no Mix and no Entry is Hidden,
 * so every live Word is eligible, for the tools and screens that only read
 * the Language Pack.
 */
export function createEntries(
  options:
    | { content: ContentReadPort; edition: Pick<Edition, 'isFeatureEnabled'> }
    | {
        content: ContentReadPort;
        edition: Pick<Edition, 'isFeatureEnabled'> & MixEdition;
        userState: Pick<UserState, 'list' | 'read'>;
      },
): Entries {
  const { content, edition } = options;
  const withCorrections = () => edition.isFeatureEnabled('corrections');

  /**
   * The live Words of the Categories in the Mix, one query per Category, or
   * every live Word without a Mix.
   */
  async function wordIds(categoryIds: readonly string[] | undefined): Promise<readonly string[]> {
    if (categoryIds === undefined) return content.listWordIds();
    const words = await Promise.all(categoryIds.map((id) => content.listWordIds(id)));
    return words.flat();
  }

  return {
    async eligible() {
      const [mix, hidden] =
        'userState' in options
          ? await Promise.all([
              readMix({ edition: options.edition, userState: options.userState }),
              options.userState.list(hiddenRecords),
            ])
          : [undefined, new Map<string, string>()];
      const [words, corrections] = await Promise.all([
        wordIds(mix?.categoryIds),
        withCorrections() && (mix?.corrections ?? true) ? content.listCorrectionIds() : [],
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
