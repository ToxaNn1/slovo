import type {
  Category,
  Correction,
  Entry,
  EntryKind,
  Rarity,
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
import { kindShown, type KindsInMix, type MixState } from './mix';
import { HIGHEST_RARITY, withinRarityCeiling } from './rarity-ceiling';
import type { ContentReadPort } from '../ports';

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
 * turns off, in the user's Mix, within the Rarity Ceiling (a Word up to it;
 * the rarities touch no other kind) and not Hidden (ADR 0015, 0019, 0040,
 * 0051, 0072). Synonym Rows and Tips are eligible by the same rules.
 */
export interface Entries {
  /**
   * The ids of the eligible Entries: the live Words of the Categories in the
   * Mix within the Rarity Ceiling, Category by Category in the Language
   * Pack's order, and the live Corrections, Idioms, Synonym Rows and Tips,
   * each kind when the Edition turns it on and it is in the Mix, each in the
   * Language Pack's stable order, leaving out every Hidden Entry. The Mix and
   * the Hidden Entries are read afresh on every call, the ids of the live
   * Entries from the Language Pack once: it never changes while it is open.
   */
  eligible(): Promise<EntryIds>;
  /**
   * The Words that would be eligible at the highest Rarity Ceiling: the live
   * Words of the Categories in the Mix that are not Hidden, whatever the
   * Rarity Ceiling, in the order `eligible` gives Words, for the Rarity Test
   * that sets the ceiling. Read afresh on every call, as `eligible` reads.
   */
  eligibleWordsOfAnyRarity(): Promise<readonly Word[]>;
  /**
   * The Words within the Rarity Ceiling, the Mix and the Hidden Entries
   * aside: every live Word up to it, in the Language Pack's order, which the
   * Daily Crossword picks from, so readers at one Ceiling get the same puzzle
   * (ADR 0072, 0073). Read afresh on every call, as `eligible` reads.
   */
  wordsUnderRarityCeiling(): Promise<readonly Word[]>;
  /**
   * Every live Correction that is not Hidden, in the Language Pack's order,
   * the Mix aside, for the Correction Types rail (ADR 0076). Read afresh on
   * every call, as `eligible` reads.
   */
  liveCorrections(): Promise<readonly Correction[]>;
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
   * The live Entries of one Category of the kind's list, the Words' or the
   * Corrections', in the Language Pack's order: a Retired one left out, the
   * Mix, the Rarity Ceiling and the Feature Switches aside, for the Category
   * screens. None for a Category the list doesn't have. Read from the
   * Language Pack once per Category; nothing becomes Seen.
   */
  ofCategory<Kind extends CategoryKind>(
    of: Kind,
    categoryId: string,
  ): Promise<readonly EntryOfKind<Kind>[]>;
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

/**
 * The reader's choices that decide which Entries are eligible, as the Mix,
 * the Rarity Ceiling and the Hidden Entries hold them now: the Entries read
 * them on every call and keep none, so a change is eligible at once.
 */
export interface EligibilityChoices {
  /** The Mix as it stands, or `everything-in`: every Category and every kind in it. */
  mix(): Pick<MixState, 'categoryIds' | 'correctionCategories' | 'kinds'> | 'everything-in';
  /** The Rarity Ceiling in force. */
  rarityCeiling(): Rarity;
  /** Whether the Entry is Hidden. */
  isHidden(entryId: string): boolean;
}

/**
 * Everything in: every Category and every kind in the Mix, at the highest
 * Rarity Ceiling, no Entry Hidden, for the tools and screens that only read
 * the Language Pack.
 */
export const EVERYTHING_IN: EligibilityChoices = {
  mix: () => 'everything-in',
  rarityCeiling: () => HIGHEST_RARITY,
  isHidden: () => false,
};

/** The Mix as the Entries read it. */
type MixChoice = ReturnType<EligibilityChoices['mix']>;

const ALL_KINDS_IN: KindsInMix = { correction: true, idiom: true, synonymRow: true, tip: true };

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
 * The Entries over the Language Pack and the reader's choices, read live from
 * `choices`; `EVERYTHING_IN` for the tools and screens that only read the
 * Language Pack.
 */
export function createEntries({
  content,
  edition,
  choices,
}: {
  content: ContentReadPort;
  edition: EntriesEdition;
  choices: EligibilityChoices;
}): Entries {
  const categories = readOnce(() => content.listCategories());
  const correctionCategories = readOnce(() => content.listCorrectionCategories());

  /** The kinds in the Mix as a whole. */
  const kindsOf = (mix: MixChoice) => (mix === 'everything-in' ? ALL_KINDS_IN : mix.kinds);

  /** Whether the reader is shown the kind as a whole now, by the Mix's one rule. */
  const shownNow = (kind: MixKind) => kindShown(edition, kindsOf(choices.mix()), kind);

  const linksCorrections = () => Promise.resolve(shownNow('correction'));

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

  /** The live Word of the id when it is within the Rarity Ceiling. */
  const wordWithinCeiling = (words: ReadonlyMap<string, Entry>, id: string, ceiling: Rarity) => {
    const word = words.get(id);
    return word?.kind === 'word' && withinRarityCeiling(word.rarity, ceiling) ? word : undefined;
  };

  /**
   * The Words of the ids within the Rarity Ceiling; every one of them at the
   * highest ceiling, without reading the Words.
   */
  async function underRarityCeiling(ids: readonly string[]): Promise<readonly string[]> {
    const ceiling = choices.rarityCeiling();
    if (ceiling >= HIGHEST_RARITY) return ids;
    const words = await live.word();
    return ids.filter((id) => wordWithinCeiling(words, id, ceiling) !== undefined);
  }

  /** The ids of the Categories of the kind's list in the Mix; none named when every one is in. */
  const categoryIdsIn = (kind: CategoryKind, mix: MixChoice) => {
    if (mix === 'everything-in') return undefined;
    return kind === 'word' ? mix.categoryIds : mix.correctionCategories.categoryIds;
  };

  async function eligible(): Promise<EntryIds> {
    const mix = choices.mix();
    const kinds = kindsOf(mix);
    const ofKind = (kind: MixKind) => (kindShown(edition, kinds, kind) ? listIds[kind]() : []);
    const [words, corrections, idioms, synonymRows, tips] = await Promise.all([
      idsInCategories('word', categoryIdsIn('word', mix)).then(underRarityCeiling),
      kindShown(edition, kinds, 'correction')
        ? idsInCategories('correction', categoryIdsIn('correction', mix))
        : [],
      ofKind('idiom'),
      ofKind('synonymRow'),
      ofKind('tip'),
    ]);
    const shown = (id: string) => !choices.isHidden(id);
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
    if (kind !== 'word' && !kindsOf(choices.mix())[kind]) {
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
    const [words, ids] = await Promise.all([
      live.word(),
      idsInCategories('word', categoryIdsIn('word', choices.mix())),
    ]);
    return ids.flatMap((id) => {
      const entry = words.get(id);
      return entry?.kind === 'word' && !choices.isHidden(id) ? [entry] : [];
    });
  }

  async function wordsUnderRarityCeiling(): Promise<readonly Word[]> {
    const ceiling = choices.rarityCeiling();
    const [words, ids] = await Promise.all([live.word(), listIds.word()]);
    return ids.flatMap((id) => {
      const word = wordWithinCeiling(words, id, ceiling);
      return word === undefined ? [] : [word];
    });
  }

  async function ofCategory<Kind extends CategoryKind>(
    of: Kind,
    categoryId: string,
  ): Promise<readonly EntryOfKind<Kind>[]> {
    const [entries, ids] = await Promise.all([live[of](), idsOfCategory(of, categoryId)]);
    const ofKind = (entry: Entry | undefined): entry is EntryOfKind<Kind> => entry?.kind === of;
    return ids.flatMap((id) => {
      const entry = entries.get(id);
      return ofKind(entry) ? [entry] : [];
    });
  }

  async function liveCorrections(): Promise<readonly Correction[]> {
    const [corrections, ids] = await Promise.all([live.correction(), listIds.correction()]);
    return ids.flatMap((id) => {
      const entry = corrections.get(id);
      return entry?.kind === 'correction' && !choices.isHidden(id) ? [entry] : [];
    });
  }

  return {
    eligible,
    eligibleWordsOfAnyRarity,
    wordsUnderRarityCeiling,
    liveCorrections,
    ofCategory,
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
      if (!shownNow('synonymRow')) return undefined;
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
