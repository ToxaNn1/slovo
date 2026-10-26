import type { Category, Correction, Entry, SynonymRow, Tip, Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import {
  featureOfKind,
  readMix,
  type MixEdition,
  type MixKindName,
  type MixState,
  type WholeKind,
} from './mix';
import type { ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/**
 * An Entry of a kind the screens show: every kind but the Synonym Row and the
 * Tip, which no screen shows yet (spec #730). The Entries leave them out, as
 * if the Language Pack didn't have them, so no screen is handed one.
 */
export type ShownEntry = Exclude<Entry, { kind: 'synonymRow' | 'tip' }>;

/** The kind of an Entry the screens show. */
export type ShownKind = ShownEntry['kind'];

const isShown = (entry: Entry): entry is ShownEntry =>
  entry.kind !== 'synonymRow' && entry.kind !== 'tip';

/** An Entry of a kind the Game may ask about: one the screens show, or a Synonym Row (spec #730). */
export type AskableEntry = ShownEntry | SynonymRow;

/** The kind of an Entry the Game may ask about. */
export type AskableKind = AskableEntry['kind'];

const isAskable = (entry: Entry): entry is AskableEntry => entry.kind !== 'tip';

/** The ids of Entries, each kind in its own list. */
export interface EntryIds {
  readonly words: readonly string[];
  readonly corrections: readonly string[];
  readonly idioms: readonly string[];
  readonly synonymRows: readonly string[];
  readonly tips: readonly string[];
}

/**
 * Why no Entry of a kind is eligible, whatever the Language Pack holds: the
 * user took the kind as a whole (Corrections, Idioms) out of the Mix. Names
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
 * 0051). Synonym Rows and Tips are eligible by the same rules, though the
 * screens are not given them yet (spec #730).
 */
export interface Entries {
  /**
   * The ids of the eligible Entries: the live Words of the Categories in the
   * Mix at the Rarity Floor or rarer, Category by Category in the Language
   * Pack's order, and the live Corrections, Idioms, Synonym Rows and Tips,
   * each kind when the Edition turns it on and it is in the Mix, each in the
   * Language Pack's stable order, leaving out every Hidden Entry. Read afresh
   * on every call.
   */
  eligible(): Promise<EntryIds>;
  /**
   * The eligible Entries of one kind themselves, in the order `eligible` gives
   * their ids, for a feature that weighs them all at once, such as the Game;
   * or, for Corrections or Idioms out of the Mix, whether or not the Edition
   * turns them on, why none are. Read afresh on every call, but for the live
   * Entries themselves, which are read from the Language Pack once: it never
   * changes while it is open. With `alsoOf`, the eligible Entries of those
   * kinds follow, none of a kind out of the Mix, and only `kind` can refuse;
   * they may be Synonym Rows, which the Game asks about.
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
   * A Synonym Row or a Tip by id, eligible or not, for the Feed, which gives
   * them their turns before any other screen shows them (spec #730). An
   * Entry of another kind reads as missing.
   */
  getSynonymRowOrTip(id: string): Promise<SynonymRow | Tip | undefined>;
  /**
   * Any Entries by id, as `get` gives each, read together in one read of the
   * Language Pack, whatever their kinds. An id the Language Pack doesn't have
   * is not in the map.
   */
  getMany(ids: readonly string[]): Promise<ReadonlyMap<string, ShownEntry>>;
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
   * links the live Word as a member, or none when no row does or the Edition
   * turns Synonym Rows off (ADR 0051). Derived from the rows: nothing on the
   * Word names it.
   */
  linkingSynonymRow(word: Word): Promise<SynonymRow | undefined>;
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
  const kindInMix = (kind: WholeKind, mix: MixState | undefined) => mix?.kinds[kind] ?? true;

  /** Whether the Edition turns the kind of Entry on and the user has it in the Mix. */
  const kindShown = (kind: WholeKind, mix: MixState | undefined) =>
    edition.isFeatureEnabled(featureOfKind(kind)) && kindInMix(kind, mix);

  const linksCorrections = async () => kindShown('correction', await readUserMix());

  /** How to list the ids of every live Entry of a kind in the Mix as a whole from the Language Pack. */
  const listIds: Record<WholeKind, () => Promise<readonly string[]>> = {
    correction: () => content.listCorrectionIds(),
    idiom: () => content.listIdiomIds(),
    synonymRow: () => content.listSynonymRowIds(),
    tip: () => content.listTipIds(),
  };

  /** How to read every live Entry of a kind from the Language Pack. */
  const readLive: Record<AskableKind, () => Promise<readonly Entry[]>> = {
    word: () => content.listWords(),
    correction: async () => content.getEntries(await listIds.correction()),
    idiom: async () => content.getEntries(await listIds.idiom()),
    synonymRow: async () => content.getEntries(await listIds.synonymRow()),
  };

  /** The Entries of the ids the screens show, read together. */
  const readShown = async (ids: readonly string[]) =>
    (await content.getEntries(ids)).filter(isShown);

  /**
   * The live Entries of each kind by id, read once: the Language Pack never
   * changes while it is open. A read that fails is tried again on the next call.
   */
  const byId = (kind: AskableKind) =>
    readOnce(
      async () =>
        new Map((await readLive[kind]()).filter(isAskable).map((entry) => [entry.id, entry])),
    );
  const live: Record<AskableKind, () => Promise<ReadonlyMap<string, AskableEntry>>> = {
    word: byId('word'),
    correction: byId('correction'),
    idiom: byId('idiom'),
    synonymRow: byId('synonymRow'),
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
  async function correctionIds(
    categoryIds: readonly string[] | undefined,
  ): Promise<readonly string[]> {
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
    const ofKind = (kind: WholeKind) => (kindShown(kind, mix) ? listIds[kind]() : []);
    const [words, corrections, idioms, synonymRows, tips] = await Promise.all([
      wordIds(mix?.categoryIds).then((ids) => atRarityFloor(ids, mix?.rarityFloor)),
      kindShown('correction', mix) ? correctionIds(mix?.correctionCategories.categoryIds) : [],
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

  /** The ids of the eligible Entries of the kind. */
  const idsOfKind: Record<AskableKind, (ids: EntryIds) => readonly string[]> = {
    word: ({ words }) => words,
    correction: ({ corrections }) => corrections,
    idiom: ({ idioms }) => idioms,
    synonymRow: ({ synonymRows }) => synonymRows,
  };

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
        idsOfKind[each](ids).flatMap((id) => entries[index]?.get(id) ?? []),
      ),
    };
  }

  return {
    eligible,
    // The kinds asked for pick the Entries returned, as the generic signature says.
    eligibleOfKind: eligibleOfKind as Entries['eligibleOfKind'],
    async get(id) {
      return (await readShown([id]))[0];
    },
    async getSynonymRowOrTip(id) {
      const [entry] = await content.getEntries([id]);
      return entry?.kind === 'synonymRow' || entry?.kind === 'tip' ? entry : undefined;
    },
    async getMany(ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Map();
      return new Map((await readShown(unique)).map((entry) => [entry.id, entry]));
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
      if (!edition.isFeatureEnabled('synonymRows')) return undefined;
      const [first] = await content.listLinkingSynonymRowIds(word.id);
      if (first === undefined) return undefined;
      const [row] = await content.getEntries([first]);
      return row?.kind === 'synonymRow' ? row : undefined;
    },
  };
}
