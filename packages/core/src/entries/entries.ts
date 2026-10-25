import type { Category, Correction, Entry, EntryKind, Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import {
  featureOfKind,
  readMix,
  type MixEdition,
  type MixKind,
  type MixKindName,
  type MixState,
} from './mix';
import type { ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** The ids of Entries, each kind in its own list. */
export interface EntryIds {
  readonly words: readonly string[];
  readonly corrections: readonly string[];
  readonly idioms: readonly string[];
}

/**
 * Why no Entry of a kind is eligible, whatever the Language Pack holds: the
 * user took the kind as a whole (Corrections, Idioms) out of the Mix. Names
 * the kind as the Edition strings do.
 */
export type KindRefusal = `${MixKindName}-out-of-mix`;

/** The eligible Entries of one kind, or why the kind, as a whole, is not eligible. */
export type EligibleOfKind =
  { readonly entries: readonly Entry[] } | { readonly refusal: KindRefusal };

/**
 * The Entries of the Language Pack as this Edition and this user may see
 * them. It is the only module that decides which Entries are eligible, so
 * the Feed, the Cycle, the Word of the Day and the card builders never check
 * Retired, a Feature Switch or the Mix themselves. An eligible Entry is live
 * (not Retired), of a kind the Edition turns on, in the user's Mix (a Word at
 * its Rarity Floor or rarer; the Rarity Floor doesn't touch Corrections or
 * Idioms) and not Hidden (ADR 0015, 0019).
 */
export interface Entries {
  /**
   * The ids of the eligible Entries: the live Words of the Categories in the
   * Mix at the Rarity Floor or rarer, Category by Category in the Language
   * Pack's order, and the live Corrections, and the live Idioms, each kind
   * when the Edition turns it on and it is in the Mix, each in the Language
   * Pack's stable order, leaving out every Hidden Entry. Read afresh on every
   * call.
   */
  eligible(): Promise<EntryIds>;
  /**
   * The eligible Entries of one kind themselves, in the order `eligible` gives
   * their ids, for a feature that weighs them all at once, such as the Game;
   * or, for Corrections or Idioms out of the Mix, whether or not the Edition
   * turns them on, why none are. Read afresh on every call, but for the live
   * Entries themselves, which are read from the Language Pack once: it never
   * changes while it is open. With `alsoOf`, the eligible Entries of those
   * kinds follow, none of a kind out of the Mix, and only `kind` can refuse.
   */
  eligibleOfKind(kind: EntryKind, alsoOf?: readonly EntryKind[]): Promise<EligibleOfKind>;
  /**
   * Any Entry by id, eligible or not: a Retired one, or a Correction or an
   * Idiom when the Edition turns its kind off. So the Entries the user keeps
   * stay reachable.
   */
  get(id: string): Promise<Entry | undefined>;
  /**
   * Any Entries by id, as `get` gives each, read together in one read of the
   * Language Pack, whatever their kinds. An id the Language Pack doesn't have
   * is not in the map.
   */
  getMany(ids: readonly string[]): Promise<ReadonlyMap<string, Entry>>;
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

  const categories = readOnce(() => content.listCategories());
  const correctionCategories = readOnce(() => content.listCorrectionCategories());

  /** The user's Mix over the Language Pack's Categories, the Words' and the Corrections'; nothing without the user state. */
  async function readUserMix() {
    if (!('userState' in options)) return undefined;
    const { edition: mixEdition, userState } = options;
    const [word, correction] = await Promise.all([categories(), correctionCategories()]);
    return readMix({ categories: { word, correction }, edition: mixEdition, userState });
  }

  /** Whether the kind of Entry, as a whole, is in the user's Mix; without a Mix it always is. */
  const kindInMix = (kind: MixKind, mix: MixState | undefined) => mix?.kinds[kind] ?? true;

  /** Whether the Edition turns the kind of Entry on and the user has it in the Mix. */
  const kindShown = (kind: MixKind, mix: MixState | undefined) =>
    edition.isFeatureEnabled(featureOfKind(kind)) && kindInMix(kind, mix);

  const linksCorrections = async () => kindShown('correction', await readUserMix());

  /** How to list the ids of every live Entry of a kind in the Mix as a whole from the Language Pack. */
  const listIds: Record<MixKind, () => Promise<readonly string[]>> = {
    correction: () => content.listCorrectionIds(),
    idiom: () => content.listIdiomIds(),
  };

  /** How to read every live Entry of a kind from the Language Pack. */
  const readLive: Record<EntryKind, () => Promise<readonly Entry[]>> = {
    word: () => content.listWords(),
    correction: async () => content.getEntries(await listIds.correction()),
    idiom: async () => content.getEntries(await listIds.idiom()),
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
    idiom: byId('idiom'),
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

  /**
   * The live Corrections of the Categories of Corrections in the Mix, in the
   * Language Pack's order, or every live Correction without a Mix (ADR 0050).
   */
  async function correctionIds(categoryIds: readonly string[] | undefined): Promise<readonly string[]> {
    const ids = await listIds.correction();
    if (categoryIds === undefined) return ids;
    const corrections = await live.correction();
    return ids.filter((id) => {
      const correction = corrections.get(id);
      return correction?.kind === 'correction' && categoryIds.includes(correction.categoryId);
    });
  }

  async function eligible(): Promise<EntryIds> {
    const [mix, hidden] = await Promise.all([
      readUserMix(),
      'userState' in options ? options.userState.list(hiddenRecords) : new Map<string, string>(),
    ]);
    const ofKind = (kind: MixKind) => (kindShown(kind, mix) ? listIds[kind]() : []);
    const [words, corrections, idioms] = await Promise.all([
      wordIds(mix?.categoryIds).then((ids) => atRarityFloor(ids, mix?.rarityFloor)),
      kindShown('correction', mix) ? correctionIds(mix?.correctionCategories.categoryIds) : [],
      ofKind('idiom'),
    ]);
    const shown = (id: string) => !hidden.has(id);
    return {
      words: words.filter(shown),
      corrections: corrections.filter(shown),
      idioms: idioms.filter(shown),
    };
  }

  /** The ids of the eligible Entries of the kind. */
  const idsOfKind: Record<EntryKind, (ids: EntryIds) => readonly string[]> = {
    word: ({ words }) => words,
    correction: ({ corrections }) => corrections,
    idiom: ({ idioms }) => idioms,
  };

  async function eligibleOfKind(
    kind: EntryKind,
    alsoOf: readonly EntryKind[] = [],
  ): Promise<EligibleOfKind> {
    if (kind !== 'word' && !kindInMix(kind, await readUserMix())) {
      return { refusal: `${featureOfKind(kind)}-out-of-mix` };
    }
    const kinds = [kind, ...alsoOf];
    const [ids, ...entries] = await Promise.all([eligible(), ...kinds.map((each) => live[each]())]);
    return {
      entries: kinds.flatMap((each, index) =>
        idsOfKind[each](ids).flatMap((id) => entries[index]?.get(id) ?? []),
      ),
    };
  }

  return {
    eligible,
    eligibleOfKind,
    async get(id) {
      return (await content.getEntries([id]))[0];
    },
    async getMany(ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Map();
      return new Map((await content.getEntries(unique)).map((entry) => [entry.id, entry]));
    },
    categories,
    linksCorrections,
    async linkedCorrections(word) {
      if (!(await linksCorrections())) return [];
      const linked = new Map(
        (await content.getEntries(word.correctionIds)).map((entry) => [entry.id, entry]),
      );
      return word.correctionIds
        .map((id) => linked.get(id))
        .filter(
          (correction): correction is Correction =>
            correction?.kind === 'correction' && !correction.retired,
        );
    },
  };
}
