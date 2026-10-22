import type { Category, Correction, Entry, EntryKind, Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { readMix, type MixEdition } from './mix';
import type { ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** The ids of Entries, each kind in its own list. */
export interface EntryIds {
  readonly words: readonly string[];
  readonly corrections: readonly string[];
}

/**
 * Why no Entry of a kind is eligible, whatever the Language Pack holds: the
 * user took Corrections, as a whole, out of the Mix.
 */
export type KindRefusal = 'corrections-out-of-mix';

/** The eligible Entries of one kind, or why the kind, as a whole, is not eligible. */
export type EligibleOfKind =
  { readonly entries: readonly Entry[] } | { readonly refusal: KindRefusal };

/**
 * The Entries of the Language Pack as this Edition and this user may see
 * them. It is the only module that decides which Entries are eligible, so
 * the Feed, the Cycle, the Word of the Day and the card builders never check
 * Retired, a Feature Switch or the Mix themselves. An eligible Entry is live
 * (not Retired), of a kind the Edition turns on, in the user's Mix (a Word at
 * its Rarity Floor or rarer) and not Hidden (ADR 0015, 0019).
 */
export interface Entries {
  /**
   * The ids of the eligible Entries: the live Words of the Categories in the
   * Mix at the Rarity Floor or rarer, Category by Category in the Language
   * Pack's order, and the live
   * Corrections when the Edition turns Corrections on and they are in the
   * Mix, each in the Language Pack's stable order, leaving out every Hidden
   * Entry. Read afresh on every call.
   */
  eligible(): Promise<EntryIds>;
  /**
   * The eligible Entries of one kind themselves, in the order `eligible` gives
   * their ids, for a feature that weighs them all at once, such as the Game;
   * or, for Corrections out of the Mix, whether or not the Edition turns them
   * on, why none are. Read afresh on every call, but for the live Entries
   * themselves, which are read from the Language Pack once: it never changes
   * while it is open.
   */
  eligibleOfKind(kind: EntryKind): Promise<EligibleOfKind>;
  /**
   * Any Entry by id, eligible or not: a Retired one, or a Correction when the
   * Edition turns Corrections off. So the Entries the user keeps stay
   * reachable.
   */
  get(id: string): Promise<Entry | undefined>;
  /**
   * Every Category of the Language Pack, with its display name, in its order,
   * read once: the pack never changes while it is open (ADR 0033).
   */
  categories(): Promise<readonly Category[]>;
  /**
   * The live Corrections the Word is the standard form for, in the order the
   * Word links them, or none when the Edition turns Corrections off or the
   * user took Corrections out of the Mix. A Correction missing from the
   * Language Pack is skipped. Read afresh on every call.
   */
  linkedCorrections(word: Word): Promise<Correction[]>;
  /**
   * Whether a Word links its Corrections at all: the Edition turns Corrections
   * on and the user has them in the Mix. Read afresh on every call, so a caller
   * can tell when the links of the Word cards it holds went stale.
   */
  linksCorrections(): Promise<boolean>;
}

const { hiddenEntries: hiddenRecords } = userStateRecords;

/**
 * Reads once and keeps the result, as the Language Pack never changes while
 * it is open; a read that fails is tried again on the next call.
 */
function readOnce<T>(read: () => Promise<T>): () => Promise<T> {
  let kept: Promise<T> | undefined;
  return () =>
    (kept ??= read().catch((error: unknown) => {
      kept = undefined;
      throw error;
    }));
}

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

  const categories = readOnce(() => content.listCategories());

  /** The user's Mix over the Language Pack's Categories; nothing without the user state. */
  async function readUserMix() {
    if (!('userState' in options)) return undefined;
    const { edition: mixEdition, userState } = options;
    return readMix({ categories: await categories(), edition: mixEdition, userState });
  }

  /** Whether Corrections, as a whole, are in the user's Mix; without a Mix they always are. */
  async function correctionsInMix(): Promise<boolean> {
    return (await readUserMix())?.corrections ?? true;
  }

  const linksCorrections = async () => withCorrections() && (await correctionsInMix());

  /** How to read every live Entry of a kind from the Language Pack. */
  const readLive: Record<EntryKind, () => Promise<readonly Entry[]>> = {
    word: () => content.listWords(),
    async correction() {
      const ids = await content.listCorrectionIds();
      const corrections = await Promise.all(ids.map((id) => content.getCorrection(id)));
      return corrections.filter((correction) => correction !== undefined);
    },
  };

  /**
   * The live Entries of each kind by id, read once: the Language Pack never
   * changes while it is open. A read that fails is tried again on the next call.
   */
  const byId = (kind: EntryKind) =>
    readOnce(async () => new Map((await readLive[kind]()).map((entry) => [entry.id, entry])));
  const live: Record<EntryKind, () => Promise<ReadonlyMap<string, Entry>>> = {
    word: byId('word'),
    correction: byId('correction'),
  };

  /**
   * The live Words of the Categories in the Mix, one query per Category, or
   * every live Word without a Mix.
   */
  async function wordIds(categoryIds: readonly string[] | undefined): Promise<readonly string[]> {
    if (categoryIds === undefined) return content.listWordIds();
    const words = await Promise.all(categoryIds.map((id) => content.listWordIds(id)));
    return words.flat();
  }

  /**
   * The Words of the ids at the Rarity Floor or above it, while the Edition
   * turns its rarityFloor switch on; every one of them otherwise, or at the lowest
   * floor, without reading the Words.
   */
  async function atRarityFloor(
    ids: readonly string[],
    floor: number | undefined,
  ): Promise<readonly string[]> {
    if (floor === undefined || floor <= 1 || !edition.isFeatureEnabled('rarityFloor')) return ids;
    const words = await live.word();
    return ids.filter((id) => {
      const word = words.get(id);
      return word?.kind === 'word' && word.rarity >= floor;
    });
  }

  async function eligible(): Promise<EntryIds> {
    const [mix, hidden] = await Promise.all([
      readUserMix(),
      'userState' in options ? options.userState.list(hiddenRecords) : new Map<string, string>(),
    ]);
    const [words, corrections] = await Promise.all([
      wordIds(mix?.categoryIds).then((ids) => atRarityFloor(ids, mix?.rarityFloor)),
      withCorrections() && (mix?.corrections ?? true) ? content.listCorrectionIds() : [],
    ]);
    const shown = (id: string) => !hidden.has(id);
    return { words: words.filter(shown), corrections: corrections.filter(shown) };
  }

  async function eligibleOfKind(kind: EntryKind): Promise<EligibleOfKind> {
    if (kind === 'correction' && !(await correctionsInMix())) {
      return { refusal: 'corrections-out-of-mix' };
    }
    const [ids, entries] = await Promise.all([eligible(), live[kind]()]);
    return {
      entries: (kind === 'word' ? ids.words : ids.corrections).flatMap(
        (id) => entries.get(id) ?? [],
      ),
    };
  }

  return {
    eligible,
    eligibleOfKind,
    async get(id) {
      return (await content.getWord(id)) ?? content.getCorrection(id);
    },
    categories,
    linksCorrections,
    async linkedCorrections(word) {
      if (!(await linksCorrections())) return [];
      const corrections = await Promise.all(
        word.correctionIds.map((id) => content.getCorrection(id)),
      );
      return corrections.filter(
        (correction): correction is Correction => correction?.retired === false,
      );
    },
  };
}
