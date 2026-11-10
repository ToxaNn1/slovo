import type { Category, EntryKind, MixKindWeight, QuickQuestionEvery } from '@slovo/contracts';

import type { DefaultMix, Edition, UserSettingDefaults } from '../edition/edition';
import { featureOfKind, MIX_KINDS, type CategoryKind, type MixKind } from './entry-kinds';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/**
 * What the Mix needs to know of the Edition: its default Mix, and which kinds
 * of Entry are on. Its Categories come from the Language Pack.
 */
export interface MixEdition {
  readonly userSettingDefaults: Pick<UserSettingDefaults, 'mix'>;
  readonly isFeatureEnabled: Edition['isFeatureEnabled'];
}

/** The kinds of Entry with Categories, in the Mix screen's order. */
const CATEGORY_KINDS: readonly CategoryKind[] = ['word', 'correction'];

/** Whether each kind of Entry is in the Mix as a whole. */
export type KindsInMix = Readonly<Record<MixKind, boolean>>;

/** The Mix kind weight of each kind of Entry beside Words. */
export type MixKindWeights = Readonly<Record<MixKind, MixKindWeight>>;

/** Every kind at «Звичайно»: the Feed's turns of 0.9, also while the Edition turns the weights off. */
export const NORMAL_KIND_WEIGHTS: MixKindWeights = {
  correction: 'normal',
  idiom: 'normal',
  synonymRow: 'normal',
  tip: 'normal',
};

/**
 * Each kind of Entry in the Mix as a whole (the kind table names them, ADR
 * 0015): its user-state record (ADR 0013, 0041) and whether the Edition's
 * default Mix holds it.
 */
const KINDS: Readonly<
  Record<
    MixKind,
    {
      readonly record: typeof userStateRecords.mixCorrections;
      readonly byDefault: (mix: DefaultMix) => boolean;
    }
  >
> = {
  correction: { record: userStateRecords.mixCorrections, byDefault: (mix) => mix.corrections },
  idiom: { record: userStateRecords.mixIdioms, byDefault: (mix) => mix.idioms },
  synonymRow: { record: userStateRecords.mixSynonymRows, byDefault: (mix) => mix.synonymRows },
  tip: { record: userStateRecords.mixTips, byDefault: (mix) => mix.tips },
};

/** How often the Feed asks a Quick Question until the user chooses: every 10th card. */
const DEFAULT_QUICK_QUESTION_EVERY: QuickQuestionEvery = 10;

/** One list of Categories in the Mix, the Words' or the Corrections', as it stands. */
export interface CategoriesInMix {
  /** Every Category of the list in the Language Pack, in or out of the Mix, with its display name, in its order (ADR 0033). */
  readonly allCategories: readonly Category[];
  /** The Categories in the Mix, by id, in the Language Pack's order. */
  readonly categoryIds: readonly string[];
  /** The Hidden Categories: the Categories out of the Mix, in the Language Pack's order (ADR 0019). */
  readonly hiddenCategories: readonly Category[];
  /** The one Category left in the Mix, which can't be taken out; nothing while more are in. */
  readonly lastCategoryId: string | undefined;
}

/**
 * The Mix as it stands. The Words' Categories are the Mix's own fields; the
 * Categories of Corrections sit under `correctionCategories`, with the same
 * rules (ADR 0033). `categoriesInMix` reads either list by kind.
 */
export interface MixState extends CategoriesInMix {
  /** The Categories of Corrections, in or out one by one under Corrections as a whole (ADR 0033). */
  readonly correctionCategories: CategoriesInMix;
  /** Whether each kind of Entry, as a whole, is in the Mix: Corrections, Idioms, Synonym Rows and Tips. */
  readonly kinds: KindsInMix;
  /**
   * The Mix kind weight of each kind beside Words, «Звичайно» unless the user
   * chose another. Apart from `kinds`: a kind out of the Mix keeps its weight.
   */
  readonly kindWeights: MixKindWeights;
  /** How often the Feed asks a Quick Question: off, or every 20th, 10th or 6th card. */
  readonly quickQuestionEvery: QuickQuestionEvery;
}

/** What a hide or an unhide is for: one Entry, one Category, or a kind of Entry (Corrections, Idioms, Synonym Rows, Tips) as a whole. */
export type HideTarget =
  | { readonly kind: 'entry'; readonly entryId: string }
  /** A Category of the Words' list, or of the Corrections' when `of` says so (ADR 0033). */
  | { readonly kind: 'category'; readonly categoryId: string; readonly of?: CategoryKind }
  | { readonly kind: 'whole-kind'; readonly entryKind: MixKind };

/** The target of a hide or an unhide of the Category of the kind's list, in its one form for each list. */
export function categoryTarget(
  categoryId: string,
  of: CategoryKind,
): Extract<HideTarget, { readonly kind: 'category' }> {
  return of === 'word' ? { kind: 'category', categoryId } : { kind: 'category', categoryId, of };
}

/** The Entry a card's hide button is for: its kind, and the Category of a Word or a Correction. */
export type EntryToHide =
  | { readonly kind: CategoryKind; readonly entryId: string; readonly categoryId: string }
  | { readonly kind: Exclude<MixKind, CategoryKind>; readonly entryId: string };

/** One option of the hide choice, with what it hides. */
export type HideOption =
  | { readonly kind: 'entry'; readonly target: Extract<HideTarget, { readonly kind: 'entry' }> }
  | {
      readonly kind: 'category';
      readonly target: Extract<HideTarget, { readonly kind: 'category' }>;
      readonly category: Category;
    }
  /**
   * The last Category of Corrections in the Mix: offered, as Corrections as
   * a whole can still be hidden beside it, but it can't be chosen (ADR 0019).
   */
  | {
      readonly kind: 'last-category';
      readonly target: Extract<HideTarget, { readonly kind: 'category' }>;
      readonly category: Category;
    }
  | {
      readonly kind: 'whole-kind';
      readonly target: Extract<HideTarget, { readonly kind: 'whole-kind' }>;
    };

/** What is out of the Mix, for the Hidden screen. */
export interface OutOfMix {
  /**
   * The Hidden Categories, the Words' and then the Corrections' (ADR 0033),
   * each in the Language Pack's order. The Corrections' are left out while
   * Corrections as a whole are not shown.
   */
  readonly categories: readonly { readonly of: CategoryKind; readonly category: Category }[];
  /** Each kind of Entry out of the Mix as a whole while the Edition turns it on, in the Mix's order. */
  readonly kinds: readonly MixKind[];
}

/** A Category's chip on the Mix screen: where it stands, the last one's chip being the one that can't be turned off (ADR 0019). */
export interface MixChip {
  readonly category: Category;
  readonly place: Exclude<CategoryPlace, undefined>;
}

/** What the Mix screen shows. */
export interface MixScreen {
  /** The chip of every Category of Words in the Language Pack, in its order. */
  readonly categories: readonly MixChip[];
  /** Whether every Category of Words is in the Mix, which is when «Усі» is on. */
  readonly allOn: boolean;
  /** The switch of each kind of Entry as a whole the Edition turns on, in the Mix's order. */
  readonly kinds: readonly { readonly entryKind: MixKind; readonly on: boolean }[];
  /** The chips of the Categories of Corrections (ADR 0033), left out while Corrections are not shown. */
  readonly correctionCategories: readonly MixChip[] | undefined;
  /** The Mix kind weight of each kind, left out while the Edition turns its mixKindWeights switch off. */
  readonly kindWeights: MixKindWeights | undefined;
}

/**
 * The Mix: the Categories, plus each other kind of Entry as a whole, the
 * user chose to see in everything new; the Rarity Ceiling is a setting apart
 * from it (ADR 0072). A Category out of the Mix is a Hidden Category, so the
 * Mix screen, the hide action and the Hidden screen all change it here (ADR
 * 0019). Read from the user state once, when it opens, like the Cycle, so
 * open one per app session (the Core composition does). A change is made in
 * memory only once it is written.
 */
export interface Mix {
  /**
   * The Mix as it stands. A change never edits it: it makes a new one and
   * tells the subscribers, so it stays the same object until something changes.
   */
  readonly state: MixState;
  /**
   * Takes the Category of the kind's list, the Words' unless given, out of
   * the Mix, which hides it. Resolves to whether it is out now: taking out
   * the last Category in the Mix of its list (`lastCategoryId`) is refused,
   * and so is a Category the list doesn't have in the Language Pack.
   */
  takeOut(categoryId: string, of?: CategoryKind): Promise<boolean>;
  /**
   * Puts the Category of the kind's list, the Words' unless given, in the Mix
   * (`inMix`) or takes it out: the one change of a Category's place the Mix
   * screen and the Category screens make. Resolves to whether it stands as
   * asked now. At least one Category of each list always stays in the Mix
   * (ADR 0019), so taking out the last one is refused, as is a Category the
   * list doesn't have in the Language Pack.
   */
  setCategory(categoryId: string, inMix: boolean, of?: CategoryKind): Promise<boolean>;
  /** Puts the Category of the kind's list, the Words' unless given, back in the Mix. One the list doesn't have is skipped. */
  putBack(categoryId: string, of?: CategoryKind): Promise<void>;
  /** Puts every Category, of Words and of Corrections, in the Mix at once. The kinds as a whole stay as they are. */
  turnAllOn(): Promise<void>;
  /** Puts the kind of Entry, as a whole, in the Mix or takes it out. */
  setKind(kind: MixKind, inMix: boolean): Promise<void>;
  /** Sets the Mix kind weight of the kind; Words fill the rest of the Feed. */
  setKindWeight(kind: MixKind, weight: MixKindWeight): Promise<void>;
  /** Sets how often the Feed asks a Quick Question. It changes nothing eligible. */
  setQuickQuestionEvery(every: QuickQuestionEvery): Promise<void>;
  /**
   * The options of the hide choice for the Entry, as the Mix stands and the
   * Edition in effect turns its kind on: always the Entry; for a Word or a
   * Correction its Category while in the Mix and in the Language Pack; for
   * any kind but Words the kind as a whole. The last Category of Words is
   * left out; the last of Corrections is a `last-category` (ADR 0019). A
   * kind not shown (`kindShown`) offers the Entry alone.
   */
  hideOptions(entry: EntryToHide): readonly HideOption[];
  /** What is out of the Mix as it stands, as the Edition in effect shows it, for the Hidden screen. */
  outOfMix(): OutOfMix;
  /** What the Mix screen shows of the Mix as it stands, as the Edition in effect shows it. */
  screen(): MixScreen;
  /** The kinds of Entry beside Words the Edition in effect turns on, in the Mix order, in the Mix or out. */
  kindsOn(): readonly MixKind[];
  /** The Mix kind weights the Feed follows: the reader's while the mixKindWeights switch is on, «Звичайно» for every kind while it is off. */
  kindWeightsInEffect(): MixKindWeights;
  /** How often the Feed asks a Quick Question: every this many cards, none while the Game, the Quick Question or the reader's choice is off. */
  quickQuestionEveryInEffect(): number | undefined;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/**
 * Each list of Categories, by the kind of Entry it belongs to: its user-state
 * records, one per Category (ADR 0013, 0041), and the Edition's default for it.
 * The two lists may share an id, so each has records of its own (ADR 0033).
 */
const CATEGORY_LISTS: Readonly<
  Record<
    CategoryKind,
    {
      readonly records: typeof userStateRecords.mixCategories;
      readonly byDefault: (mix: DefaultMix) => 'all' | readonly string[];
    }
  >
> = {
  word: { records: userStateRecords.mixCategories, byDefault: (mix) => mix.categoryIds },
  correction: {
    records: userStateRecords.mixCorrectionCategories,
    byDefault: (mix) => mix.correctionCategoryIds,
  },
};

const { mixKindWeights: kindWeightRecords, mixQuickQuestion: quickQuestionRecord } =
  userStateRecords;

/** The Categories of the Language Pack, each kind's list. */
type CategoryLists = Readonly<Record<CategoryKind, readonly Category[]>>;

/** The places the user chose, by Category id, for each kind's list. */
type CategoryChoices = Readonly<Record<CategoryKind, ReadonlyMap<string, boolean>>>;

/** The places in the Mix the user chose: by Category of each list, by kind of Entry as a whole. */
interface MixChoices {
  readonly categories: CategoryChoices;
  readonly kinds: Readonly<Record<MixKind, boolean | undefined>>;
  readonly kindWeights: ReadonlyMap<string, MixKindWeight>;
  readonly quickQuestionEvery: QuickQuestionEvery | undefined;
}

/** A record over each kind of Entry in the Mix as a whole, from what `of` gives for it. */
function eachKind<T>(of: (kind: MixKind) => T): Readonly<Record<MixKind, T>> {
  return {
    correction: of('correction'),
    idiom: of('idiom'),
    synonymRow: of('synonymRow'),
    tip: of('tip'),
  };
}

/** A record over each kind of Entry with Categories, from what `of` gives for it. */
function eachList<T>(of: (kind: CategoryKind) => T): Readonly<Record<CategoryKind, T>> {
  return { word: of('word'), correction: of('correction') };
}

/** Whether the Edition in effect turns the kind of Entry on: the Edition does and no remote Feature Switch turns it off. */
function kindOn(edition: Pick<Edition, 'isFeatureEnabled'>, kind: MixKind): boolean {
  return edition.isFeatureEnabled(featureOfKind(kind));
}

/**
 * Whether the reader is shown the kind of Entry as a whole: the Edition turns
 * it on, no remote Feature Switch turns it off and the user has it in the Mix.
 * The one rule of the kinds: the Entries, the screens and the statistics follow it.
 */
export function kindShown(
  edition: Pick<Edition, 'isFeatureEnabled'>,
  kinds: KindsInMix,
  kind: MixKind,
): boolean {
  return kindOn(edition, kind) && kinds[kind];
}

/**
 * The kinds of Entry the reader is shown as a whole, in the Mix order: the
 * Words always, and each other kind `kindShown` shows. The Known counts of
 * the statistics join these.
 */
export function kindsShown({
  edition,
  mix,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  mix: Pick<MixState, 'kinds'>;
}): readonly EntryKind[] {
  return ['word', ...MIX_KINDS.filter((kind) => kindShown(edition, mix.kinds, kind))];
}

/** The list of Categories of the kind in the Mix as it stands: the Words' are the Mix's own fields. */
export function categoriesInMix(state: MixState, of: CategoryKind): CategoriesInMix {
  return of === 'word' ? state : state.correctionCategories;
}

/**
 * Where a Category of a list stands in the Mix: in, in as the last Category
 * of its list, which can't be taken out (ADR 0019), or out; nothing for a
 * Category the list doesn't have in the Language Pack.
 */
export type CategoryPlace = 'in' | 'last' | 'out' | undefined;

/** Where the Category of the kind's list stands in the Mix (`CategoryPlace`). */
export function categoryPlace(
  state: MixState,
  of: CategoryKind,
  categoryId: string,
): CategoryPlace {
  const list = categoriesInMix(state, of);
  if (!list.allCategories.some(({ id }) => id === categoryId)) return undefined;
  return placeIn(list, categoryId);
}

/** Where a Category the list has stands in it. */
function placeIn(list: CategoriesInMix, categoryId: string): Exclude<CategoryPlace, undefined> {
  if (list.lastCategoryId === categoryId) return 'last';
  return list.categoryIds.includes(categoryId) ? 'in' : 'out';
}

/** The option that hides the Category of the kind's list, or nothing while it is out of the Mix or the Language Pack doesn't have it. */
function categoryOption(state: MixState, of: CategoryKind, categoryId: string): HideOption[] {
  const place = categoryPlace(state, of, categoryId);
  const category = categoriesInMix(state, of).allCategories.find(({ id }) => id === categoryId);
  if (category === undefined || place === undefined || place === 'out') return [];
  // The last Category of Words is left out; the last of Corrections is offered, as Corrections as a whole can go (ADR 0019).
  if (place === 'last' && of === 'word') return [];
  const target = categoryTarget(categoryId, of);
  return [{ kind: place === 'last' ? 'last-category' : 'category', target, category }];
}

function hideOptionsOf(
  edition: Pick<Edition, 'isFeatureEnabled'>,
  state: MixState,
  entry: EntryToHide,
): readonly HideOption[] {
  const entryOption: HideOption = {
    kind: 'entry',
    target: { kind: 'entry', entryId: entry.entryId },
  };
  if (entry.kind === 'word')
    return [entryOption, ...categoryOption(state, 'word', entry.categoryId)];
  if (!kindShown(edition, state.kinds, entry.kind)) return [entryOption];
  const wholeKind: HideOption = {
    kind: 'whole-kind',
    target: { kind: 'whole-kind', entryKind: entry.kind },
  };
  return entry.kind === 'correction'
    ? [entryOption, ...categoryOption(state, 'correction', entry.categoryId), wholeKind]
    : [entryOption, wholeKind];
}

function outOfMixOf(edition: Pick<Edition, 'isFeatureEnabled'>, state: MixState): OutOfMix {
  const hiddenOf = (of: CategoryKind) =>
    categoriesInMix(state, of).hiddenCategories.map((category) => ({ of, category }));
  return {
    categories: [
      ...hiddenOf('word'),
      ...(kindShown(edition, state.kinds, 'correction') ? hiddenOf('correction') : []),
    ],
    kinds: MIX_KINDS.filter((kind) => kindOn(edition, kind) && !state.kinds[kind]),
  };
}

function screenOf(edition: Pick<Edition, 'isFeatureEnabled'>, state: MixState): MixScreen {
  const chips = (of: CategoryKind): MixChip[] =>
    categoriesInMix(state, of).allCategories.map((category) => ({
      category,
      place: placeIn(categoriesInMix(state, of), category.id),
    }));
  return {
    categories: chips('word'),
    allOn: state.hiddenCategories.length === 0,
    kinds: MIX_KINDS.filter((kind) => kindOn(edition, kind)).map((entryKind) => ({
      entryKind,
      on: state.kinds[entryKind],
    })),
    correctionCategories: kindShown(edition, state.kinds, 'correction')
      ? chips('correction')
      : undefined,
    kindWeights: edition.isFeatureEnabled('mixKindWeights') ? state.kindWeights : undefined,
  };
}

/** Whether the Category is in the Edition's default Mix of its list: always when the default is all. */
function inByDefault(mix: DefaultMix, of: CategoryKind, categoryId: string): boolean {
  const ids = CATEGORY_LISTS[of].byDefault(mix);
  return ids === 'all' || ids.includes(categoryId);
}

/**
 * Whether the Category of the kind's list is in the Mix by the user's choice
 * or, untouched, by the Edition's default (ADR 0019).
 */
function inMixByChoice(
  edition: MixEdition,
  choices: MixChoices,
  of: CategoryKind,
  categoryId: string,
): boolean {
  return (
    choices.categories[of].get(categoryId) ??
    inByDefault(edition.userSettingDefaults.mix, of, categoryId)
  );
}

/** One list of the user's choices over the Edition's default Mix, for the Language Pack's Categories of the kind. */
function categoriesInMixOf(
  categories: readonly Category[],
  edition: MixEdition,
  choices: MixChoices,
  of: CategoryKind,
): CategoriesInMix {
  const { mix } = edition.userSettingDefaults;
  let inMix: readonly Category[] = categories.filter(({ id }) =>
    inMixByChoice(edition, choices, of, id),
  );
  // At least one Category of each list always stays in the Mix (ADR 0019). Taking
  // out the last one is refused, but a later default, a Category gone from the
  // Language Pack or a merge of two devices that each took out a different last
  // one could still leave none in; then the default's Categories are in, or every
  // Category when the pack has none of them. Nothing is written for it (ADR 0013).
  if (inMix.length === 0) inMix = categories.filter(({ id }) => inByDefault(mix, of, id));
  if (inMix.length === 0) inMix = categories;
  const categoryIds = inMix.map(({ id }) => id);
  return {
    allCategories: categories,
    categoryIds,
    hiddenCategories: categories.filter(({ id }) => !categoryIds.includes(id)),
    lastCategoryId: categoryIds.length === 1 ? categoryIds[0] : undefined,
  };
}

/** The Mix of the user's choices over the Edition's default Mix, for the Language Pack's Categories. */
function mixStateOf(lists: CategoryLists, edition: MixEdition, choices: MixChoices): MixState {
  const { mix } = edition.userSettingDefaults;
  return {
    ...categoriesInMixOf(lists.word, edition, choices, 'word'),
    correctionCategories: categoriesInMixOf(lists.correction, edition, choices, 'correction'),
    kinds: eachKind((kind) => choices.kinds[kind] ?? KINDS[kind].byDefault(mix)),
    kindWeights: eachKind((kind) => choices.kindWeights.get(kind) ?? NORMAL_KIND_WEIGHTS[kind]),
    quickQuestionEvery: choices.quickQuestionEvery ?? DEFAULT_QUICK_QUESTION_EVERY,
  };
}

async function readChoices(userState: Pick<UserState, 'list' | 'read'>): Promise<MixChoices> {
  const [lists, read, kindWeights, quickQuestionEvery] = await Promise.all([
    Promise.all(CATEGORY_KINDS.map((kind) => userState.list(CATEGORY_LISTS[kind].records))),
    Promise.all(MIX_KINDS.map((kind) => userState.read(KINDS[kind].record))),
    userState.list(kindWeightRecords),
    userState.read(quickQuestionRecord),
  ]);
  return {
    categories: eachList((kind) => lists[CATEGORY_KINDS.indexOf(kind)] ?? new Map()),
    kinds: eachKind((kind) => read[MIX_KINDS.indexOf(kind)]),
    kindWeights,
    quickQuestionEvery,
  };
}

/**
 * Opens the Mix over the user state and the Language Pack's Categories, which
 * the Entries read once per Patch (ADR 0090). For the
 * Core composition: each change publishes `eligibility`, so the Cycle reads
 * the eligible Entries again and the Feed, the plan and the Game follow.
 */
export async function openMix({
  edition,
  categories,
  userState,
  eligibility,
}: {
  edition: MixEdition;
  categories: CategoryLists;
  userState: UserState;
  eligibility: Pick<Subject<void>, 'publish'>;
}): Promise<Mix> {
  let choices = await readChoices(userState);
  let state = mixStateOf(categories, edition, choices);
  const subscribers = createSubscribers();

  const isCategory = (categoryId: string, of: CategoryKind) =>
    categories[of].some(({ id }) => id === categoryId);

  /**
   * Writes the new places in the Mix, then makes the change in memory before
   * eligibility is read again, so the Entries read the new state, and tells
   * the subscribers last, so one told of the new state finds eligibility read
   * again. The state follows the written change even when reading
   * eligibility again fails; the next change or the next app session reads
   * it again.
   */
  async function change(
    places: Partial<Record<CategoryKind, ReadonlyMap<string, boolean>>>,
    {
      kinds = state.kinds,
      kindWeights = state.kindWeights,
      quickQuestionEvery = state.quickQuestionEvery,
    }: {
      kinds?: KindsInMix;
      kindWeights?: MixKindWeights;
      quickQuestionEvery?: QuickQuestionEvery;
    } = {},
  ): Promise<void> {
    const writes = new Map<string, string | undefined>();
    const changed = eachList((of) => {
      const wanted = new Map<string, boolean>();
      // A Category in only because none would be otherwise is written in, so the
      // Mix stays as the reader sees it.
      for (const id of categoriesInMix(state, of).categoryIds) wanted.set(id, true);
      for (const [id, isIn] of places[of] ?? []) wanted.set(id, isIn);
      const next = new Map(choices.categories[of]);
      for (const [id, isIn] of wanted) {
        if (inMixByChoice(edition, choices, of, id) === isIn) continue;
        next.set(id, isIn);
        for (const [key, value] of CATEGORY_LISTS[of].records.record(id).change(isIn)) {
          writes.set(key, value);
        }
      }
      return next;
    });
    for (const kind of MIX_KINDS) {
      if (kinds[kind] === state.kinds[kind]) continue;
      for (const [key, value] of KINDS[kind].record.change(kinds[kind])) writes.set(key, value);
    }
    const weights = new Map(choices.kindWeights);
    for (const kind of MIX_KINDS) {
      if (kindWeights[kind] === state.kindWeights[kind]) continue;
      weights.set(kind, kindWeights[kind]);
      for (const [key, value] of kindWeightRecords.record(kind).change(kindWeights[kind])) {
        writes.set(key, value);
      }
    }
    // How often the Quick Question comes changes nothing eligible, so alone it
    // doesn't make the Cycle read eligibility again.
    const eligibilityChanged = writes.size > 0;
    if (quickQuestionEvery !== state.quickQuestionEvery) {
      for (const [key, value] of quickQuestionRecord.change(quickQuestionEvery)) {
        writes.set(key, value);
      }
    }
    if (writes.size === 0) return;
    await userState.write(writes);
    const next: MixChoices = {
      categories: changed,
      kinds: eachKind((kind) =>
        kinds[kind] === state.kinds[kind] ? choices.kinds[kind] : kinds[kind],
      ),
      kindWeights: weights,
      quickQuestionEvery:
        quickQuestionEvery === state.quickQuestionEvery
          ? choices.quickQuestionEvery
          : quickQuestionEvery,
    };
    choices = next;
    state = mixStateOf(categories, edition, next);
    try {
      if (eligibilityChanged) await eligibility.publish();
    } finally {
      subscribers.tell();
    }
  }

  async function takeOut(categoryId: string, of: CategoryKind): Promise<boolean> {
    if (!isCategory(categoryId, of)) return false;
    const list = categoriesInMix(state, of);
    if (!list.categoryIds.includes(categoryId)) return true;
    if (list.lastCategoryId === categoryId) return false;
    await change({ [of]: new Map([[categoryId, false]]) });
    return true;
  }

  async function setCategory(
    categoryId: string,
    inMix: boolean,
    of: CategoryKind,
  ): Promise<boolean> {
    if (!inMix) return takeOut(categoryId, of);
    if (!isCategory(categoryId, of)) return false;
    await putBack(categoryId, of);
    return true;
  }

  async function putBack(categoryId: string, of: CategoryKind): Promise<void> {
    if (
      !isCategory(categoryId, of) ||
      categoriesInMix(state, of).categoryIds.includes(categoryId)
    ) {
      return;
    }
    await change({ [of]: new Map([[categoryId, true]]) });
  }

  async function turnAllOn(): Promise<void> {
    await change(eachList((of) => new Map(categories[of].map(({ id }) => [id, true]))));
  }

  async function setKind(kind: MixKind, inMix: boolean): Promise<void> {
    await change({}, { kinds: { ...state.kinds, [kind]: inMix } });
  }

  async function setKindWeight(kind: MixKind, weight: MixKindWeight): Promise<void> {
    await change({}, { kindWeights: { ...state.kindWeights, [kind]: weight } });
  }

  const inTurn = createInTurn();

  return {
    get state() {
      return state;
    },
    takeOut: (categoryId, of = 'word') => inTurn(() => takeOut(categoryId, of)),
    setCategory: (categoryId, inMix, of = 'word') =>
      inTurn(() => setCategory(categoryId, inMix, of)),
    putBack: (categoryId, of = 'word') => inTurn(() => putBack(categoryId, of)),
    turnAllOn: () => inTurn(turnAllOn),
    setKind: (kind, inMix) => inTurn(() => setKind(kind, inMix)),
    setKindWeight: (kind, weight) => inTurn(() => setKindWeight(kind, weight)),
    setQuickQuestionEvery: (quickQuestionEvery) => inTurn(() => change({}, { quickQuestionEvery })),
    hideOptions: (entry) => hideOptionsOf(edition, state, entry),
    outOfMix: () => outOfMixOf(edition, state),
    screen: () => screenOf(edition, state),
    kindsOn: () => MIX_KINDS.filter((kind) => kindOn(edition, kind)),
    kindWeightsInEffect: () =>
      edition.isFeatureEnabled('mixKindWeights') ? state.kindWeights : NORMAL_KIND_WEIGHTS,
    quickQuestionEveryInEffect: () =>
      edition.isFeatureEnabled('quickQuestion') && state.quickQuestionEvery !== 'off'
        ? state.quickQuestionEvery
        : undefined,
    subscribe: subscribers.subscribe,
  };
}
