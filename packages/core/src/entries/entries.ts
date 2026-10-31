import type {
  Category,
  Correction,
  Entry,
  EntryKind,
  SynonymRow,
  Tip,
  Word,
} from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import {
  ENTRY_KINDS,
  featureOfKind,
  tableOfKinds,
  type CategoryKind,
  type EntryOfKind,
  type KindNames,
  type MixKind,
  type MixKindName,
  type ShownKind,
} from './entry-kinds';
import { readMix, type MixEdition, type MixState } from './mix';
import type { ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

export type { ShownKind } from './entry-kinds';

/**
 * An Entry of a kind every screen shows: every kind but the Synonym Row and
 * the Tip, which only the Feed, the lists and the Entry screen a list opens
 * show yet (spec #730). `get` and `getMany` leave them out, as if the
 * Language Pack didn't have them, so no other screen is handed one.
 */
export type ShownEntry = EntryOfKind<ShownKind>;

const isShown = (entry: Entry): entry is ShownEntry => ENTRY_KINDS[entry.kind].shown;

/** An Entry of a kind the Game may ask about: one the screens show, a Synonym Row or a Tip (spec #730). */
export type AskableEntry = ShownEntry | SynonymRow | Tip;

/** The kind of an Entry the Game may ask about. */
export type AskableKind = AskableEntry['kind'];

/** The ids of Entries, each kind in its own list, under the kind's name as a whole. */
export type EntryIds = {
  readonly [Kind in EntryKind as KindNames[Kind]]: readonly string[];
};

/**
 * Why no Entry of a kind is eligible, whatever the Language Pack holds: the
 * user took the kind as a whole (Corrections, Idioms, Synonym Rows, Tips) out of the Mix. Names
 * the kind as the Edition strings do.
 */
export type KindRefusal = `${MixKindName}-out-of-mix`;

/** The eligible Entries of one kind, or why the kind, as a whole, is not eligible. */
export type EligibleOfKind<E extends AskableEntry = ShownEntry> =
  { readonly entries: readonly E[] } | { readonly refusal: KindRefusal };

/**
 * The Entries of the Language Pack as this Edition and this user may see
 * them. It is the only module that decides which Entries are eligible, so
 * the Feed, the Cycle, the Word of the Day and the card builders never check
 * Retired, a Feature Switch or the Mix themselves. An eligible Entry is live
 * (not Retired), of a kind the Edition turns on and no remote Feature Switch
 * turns off, in the user's Mix (a Word at its Rarity Floor or rarer; the
 * Rarity Floor touches no other kind) and not Hidden (ADR 0015, 0019, 0040,
 * 0051). Synonym Rows and Tips are eligible by the same rules.
 */
export interface Entries {
  /**
   * The ids of the eligible Entries: the live Words of the Categories in the
   * Mix at the Rarity Floor or rarer, Category by Category in the Language
   * Pack's order, and the live Corrections, Idioms, Synonym Rows and Tips,
   * each kind when the Edition turns it on and it is in the Mix, each in the
   * Language Pack's stable order, leaving out every Hidden Entry. The Mix and
   * the Hidden Entries are read afresh on every call, the ids of the live
   * Entries from the Language Pack once: it never changes while it is open.
   */
  eligible(): Promise<EntryIds>;
  /**
   * The Words that would be eligible at the lowest Rarity Floor: the live
   * Words of the Categories in the Mix that are not Hidden, whatever the
   * Rarity Floor, in the order `eligible` gives Words, for the Rarity Test
   * that sets the floor. Read afresh on every call, as `eligible` reads.
   */
  eligibleWordsOfAnyRarity(): Promise<readonly Word[]>;
  /**
   * The eligible Entries of one kind themselves, in the order `eligible` gives
   * their ids, for a feature that weighs them all at once, such as the Game;
   * or, for Corrections or Idioms out of the Mix, whether or not the Edition
   * turns them on, why none are. Read afresh on every call, as `eligible`
   * reads, but for the live Entries themselves, which are read from the
   * Language Pack once. With `alsoOf`, the eligible Entries of those
   * kinds follow, none of a kind out of the Mix, and only `kind` can refuse;
   * they may be Synonym Rows or Tips, which the Game asks about.
   */
  eligibleOfKind<Also extends AskableKind = never>(
    kind: ShownKind,
    alsoOf?: readonly Also[],
  ): Promise<EligibleOfKind<Extract<AskableEntry, { kind: ShownKind | Also }>>>;
  /**
   * Any Entry by id, eligible or not: a Retired one, or a Correction or an
   * Idiom when the Edition turns its kind off. So the Entries the user keeps
   * stay reachable. A Synonym Row or a Tip reads as missing.
   */
  get(id: string): Promise<ShownEntry | undefined>;
  /**
   * A Synonym Row or a Tip by id, eligible or not, for its card on the Feed
   * and the Entry screen a list opens (spec #730). An Entry of another kind
   * reads as missing.
   */
  getSynonymRowOrTip(id: string): Promise<SynonymRow | Tip | undefined>;
  /**
   * Any Entries by id, as `get` gives each, read together in one read of the
   * Language Pack, whatever their kinds. An id the Language Pack doesn't have
   * is not in the map.
   */
  getMany(ids: readonly string[]): Promise<ReadonlyMap<string, ShownEntry>>;
  /**
   * Any Entries by id, as `getMany` reads them, Synonym Rows and Tips too: the
   * lists that keep an Entry (Favorites, Collections, History) list every
   * kind (spec #730).
   */
  getManyOfAnyKind(ids: readonly string[]): Promise<ReadonlyMap<string, AskableEntry>>;
  /**
   * Every Category of the Language Pack, with its display name, in its order,
   * read once: the pack never changes while it is open (ADR 0033).
   */
  categories(): Promise<readonly Category[]>;
  /** Every Category of Corrections of the Language Pack, as `categories` gives the Words'. */
  correctionCategories(): Promise<readonly Category[]>;
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
  /**
   * The first live Synonym Row, in the Language Pack's stable order, that
   * links the live Word as a member, or none when no row does, the Edition
   * turns Synonym Rows off or the reader keeps them out of the Mix (ADR 0051).
   * Derived from the rows: nothing on the Word names it.
   */
  linkingSynonymRow(word: Word): Promise<SynonymRow | undefined>;
  /**
   * The file name of the Word's Illustration, or none when the Word has none,
   * the app doesn't bundle the file a content update names or the Edition or
   * a remote Feature Switch turns `illustrations` off (ADR 0055).
   */
  illustrationOf(word: Word): string | undefined;
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
 * What the Entries ask of the Edition. One that leaves out `illustrations`,
 * as in tests of other features, bundles no Illustration.
 */
type EntriesEdition = Pick<Edition, 'isFeatureEnabled'> & Partial<Pick<Edition, 'illustrations'>>;

/**
 * The Entries over the Language Pack, and over the user's choices in the user
 * state when it is given. Without it there is no Mix and no Entry is Hidden,
 * so every live Word is eligible, for the tools and screens that only read
 * the Language Pack.
 */
export function createEntries(
  options:
    | { content: ContentReadPort; edition: EntriesEdition }
    | {
        content: ContentReadPort;
        edition: EntriesEdition & MixEdition;
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

  /**
   * The ids of every live Entry of each kind, read once from the Language
   * Pack: every Game Mode's offer reads them again.
   */
  const listIds = tableOfKinds((kind) => readOnce(() => content.listIds(kind)));

  /**
   * How to read every live Entry of a kind from the Language Pack: the Words
   * at once, as the Game's Distractors need them all, the other kinds by
   * their ids.
   */
  const readLive: Readonly<Record<EntryKind, () => Promise<readonly Entry[]>>> = {
    ...tableOfKinds((kind) => async () => content.getEntries(await listIds[kind]())),
    word: () => content.listWords(),
  };

  /** The Entries of the ids the screens show, read together. */
  const readShown = async (ids: readonly string[]) =>
    (await content.getEntries(ids)).filter(isShown);

  /**
   * The live Entries of each kind by id, read once: the Language Pack never
   * changes while it is open. A read that fails is tried again on the next call.
   */
  const live = tableOfKinds((kind) =>
    readOnce(async () => new Map((await readLive[kind]()).map((entry) => [entry.id, entry]))),
  );

  /** The ids of the live Entries of each Category of a kind with Categories, each read once. */
  const idsByCategory = new Map<string, () => Promise<readonly string[]>>();
  function idsOfCategory(kind: CategoryKind, categoryId: string): Promise<readonly string[]> {
    const key = `${kind} ${categoryId}`;
    let read = idsByCategory.get(key);
    if (read === undefined) {
      read = readOnce(() => content.listIds(kind, categoryId));
      idsByCategory.set(key, read);
    }
    return read();
  }

  /**
   * The live Entries of the kind in the Categories, one query per Category
   * the first time, Category by Category in the Categories' order (the Words'
   * of the Mix, or the Corrections' under Corrections as a whole, ADR 0033),
   * or every live Entry of the kind without a Mix.
   */
  async function idsInCategories(
    kind: CategoryKind,
    categoryIds: readonly string[] | undefined,
  ): Promise<readonly string[]> {
    if (categoryIds === undefined) return listIds[kind]();
    const ids = await Promise.all(categoryIds.map((categoryId) => idsOfCategory(kind, categoryId)));
    return ids.flat();
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

  /** The ids of the Hidden Entries; none without the user state. */
  const hiddenIds = () =>
    'userState' in options ? options.userState.list(hiddenRecords) : new Map<string, string>();

  async function eligible(): Promise<EntryIds> {
    const [mix, hidden] = await Promise.all([readUserMix(), hiddenIds()]);
    const ofKind = (kind: MixKind) => (kindShown(kind, mix) ? listIds[kind]() : []);
    const [words, corrections, idioms, synonymRows, tips] = await Promise.all([
      idsInCategories('word', mix?.categoryIds).then((ids) => atRarityFloor(ids, mix?.rarityFloor)),
      kindShown('correction', mix)
        ? idsInCategories('correction', mix?.correctionCategories.categoryIds)
        : [],
      ofKind('idiom'),
      ofKind('synonymRow'),
      ofKind('tip'),
    ]);
    const shown = (id: string) => !hidden.has(id);
    return {
      words: words.filter(shown),
      corrections: corrections.filter(shown),
      idioms: idioms.filter(shown),
      synonymRows: synonymRows.filter(shown),
      tips: tips.filter(shown),
    };
  }

  /** The ids of the eligible Entries of the kind, under the kind's name. */
  const idsOfKind = (kind: AskableKind, ids: EntryIds) => ids[ENTRY_KINDS[kind].name];

  async function eligibleOfKind(
    kind: ShownKind,
    alsoOf: readonly AskableKind[] = [],
  ): Promise<EligibleOfKind<AskableEntry>> {
    if (kind !== 'word' && !kindInMix(kind, await readUserMix())) {
      return { refusal: `${featureOfKind(kind)}-out-of-mix` };
    }
    const kinds = [kind, ...alsoOf];
    const [ids, ...entries] = await Promise.all([eligible(), ...kinds.map((each) => live[each]())]);
    return {
      entries: kinds.flatMap((each, index) =>
        idsOfKind(each, ids).flatMap((id) => entries[index]?.get(id) ?? []),
      ),
    };
  }

  async function eligibleWordsOfAnyRarity(): Promise<readonly Word[]> {
    const [mix, hidden, words] = await Promise.all([readUserMix(), hiddenIds(), live.word()]);
    const ids = await idsInCategories('word', mix?.categoryIds);
    return ids.flatMap((id) => {
      const entry = words.get(id);
      return entry?.kind === 'word' && !hidden.has(id) ? [entry] : [];
    });
  }

  return {
    eligible,
    eligibleWordsOfAnyRarity,
    // The kinds asked for pick the Entries returned, as the generic signature says.
    eligibleOfKind: eligibleOfKind as Entries['eligibleOfKind'],
    async get(id) {
      return (await readShown([id]))[0];
    },
    async getSynonymRowOrTip(id) {
      const [entry] = await content.getEntries([id]);
      return entry !== undefined && !isShown(entry) ? entry : undefined;
    },
    async getMany(ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Map();
      return new Map((await readShown(unique)).map((entry) => [entry.id, entry]));
    },
    async getManyOfAnyKind(ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Map();
      return new Map((await content.getEntries(unique)).map((entry) => [entry.id, entry]));
    },
    categories,
    correctionCategories,
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
    async linkingSynonymRow(word) {
      // Like a link to a Correction, none while the reader keeps Synonym Rows out of the Mix.
      if (!kindShown('synonymRow', await readUserMix())) return undefined;
      const [first] = await content.listLinkingSynonymRowIds(word.id);
      if (first === undefined) return undefined;
      const [row] = await content.getEntries([first]);
      return row?.kind === 'synonymRow' ? row : undefined;
    },
    illustrationOf({ illustration }) {
      return illustration !== undefined &&
        edition.isFeatureEnabled('illustrations') &&
        edition.illustrations?.has(illustration) === true
        ? illustration
        : undefined;
    },
  };
}
