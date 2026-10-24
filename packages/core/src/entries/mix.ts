import { RaritySchema, type Category, type EntryKind } from '@slovo/contracts';

import type { DefaultMix, UserSettingDefaults } from '../edition/edition';
import { createInTurn, createSubscribers } from '../in-turn';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** What the Mix needs to know of the Edition: its default Mix. Its Categories come from the Language Pack. */
export interface MixEdition {
  readonly userSettingDefaults: Pick<UserSettingDefaults, 'mix'>;
}

/**
 * A kind of Entry that is in or out of the Mix as a whole: every kind but
 * the Word, whose Categories are in or out one by one (ADR 0019).
 */
export type MixKind = Exclude<EntryKind, 'word'>;

/** Whether each kind of Entry is in the Mix as a whole. */
export type KindsInMix = Readonly<Record<MixKind, boolean>>;

/**
 * The name of a kind of Entry as a whole: its Feature Switch, the key of its
 * Edition strings and the first word of its Game refusal.
 */
export type MixKindName = 'corrections' | 'idioms';

/**
 * Each kind of Entry in the Mix as a whole, in the Mix screen's order: the
 * Feature Switch that turns it on, which names the kind as a whole
 * (`corrections`, `idioms`) in the Edition strings and the Game's refusals;
 * its user-state record (ADR 0013, 0041); and whether the Edition's default
 * Mix holds it. A further kind is one more line here and nowhere else.
 */
const KINDS: Readonly<
  Record<
    MixKind,
    {
      readonly feature: MixKindName;
      readonly record: typeof userStateRecords.mixCorrections;
      readonly byDefault: (mix: DefaultMix) => boolean;
    }
  >
> = {
  correction: {
    feature: 'corrections',
    record: userStateRecords.mixCorrections,
    byDefault: (mix) => mix.corrections,
  },
  idiom: { feature: 'idioms', record: userStateRecords.mixIdioms, byDefault: (mix) => mix.idioms },
};

/** The kinds of Entry in the Mix as a whole, in the Mix screen's order. */
export const MIX_KINDS = Object.keys(KINDS) as readonly MixKind[];

/** The Feature Switch that turns the kind of Entry on, which also names the kind as a whole. */
export const featureOfKind = (kind: MixKind): MixKindName => KINDS[kind].feature;

/** The Mix as it stands. */
export interface MixState {
  /** Every Category of the Language Pack, in or out of the Mix, with its display name, in its order (ADR 0033). */
  readonly allCategories: readonly Category[];
  /** The Categories in the Mix, by id, in the Language Pack's order. */
  readonly categoryIds: readonly string[];
  /** Whether each kind of Entry, as a whole, is in the Mix: Corrections and Idioms. */
  readonly kinds: KindsInMix;
  /** The Hidden Categories: the Categories out of the Mix, in the Language Pack's order (ADR 0019). */
  readonly hiddenCategories: readonly Category[];
  /** The one Category left in the Mix, which can't be taken out; nothing while more are in. */
  readonly lastCategoryId: string | undefined;
  /**
   * The Rarity Floor, 1 to 5: only Words of that rarity or rarer are eligible
   * while the Edition turns its rarityFloor switch on. Corrections and Idioms have no rarity.
   */
  readonly rarityFloor: number;
}

/**
 * The Mix: the Categories, plus each other kind of Entry as a whole, the
 * user chose to see in everything new, and the Rarity Floor. A Category out of the Mix is a Hidden Category, so the
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
   * Takes the Category out of the Mix, which hides it. Resolves to whether it
   * is out now: taking out the last Category in the Mix (`lastCategoryId`) is
   * refused, and so is a Category the Language Pack doesn't have.
   */
  takeOut(categoryId: string): Promise<boolean>;
  /** Puts the Category back in the Mix. A Category the Language Pack doesn't have is skipped. */
  putBack(categoryId: string): Promise<void>;
  /** Puts every Category in the Mix at once. The kinds as a whole stay as they are. */
  turnAllOn(): Promise<void>;
  /** Puts the kind of Entry, as a whole, in the Mix or takes it out. */
  setKind(kind: MixKind, inMix: boolean): Promise<void>;
  /** Sets the Rarity Floor. A floor that is not a rarity, a whole number from 1 to 5, is skipped. */
  setRarityFloor(floor: number): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { mixCategories: categoryRecords, mixRarityFloor: rarityFloorRecord } = userStateRecords;

/** The Rarity Floor while the user chose none: every Word is in. */
const DEFAULT_RARITY_FLOOR = 1;

/** The places in the Mix the user chose: by Category id, by kind of Entry as a whole; and the Rarity Floor. */
interface MixChoices {
  readonly categories: ReadonlyMap<string, boolean>;
  readonly kinds: Readonly<Record<MixKind, boolean | undefined>>;
  readonly rarityFloor: number | undefined;
}

/** A record over each kind of Entry in the Mix as a whole, from what `of` gives for it. */
function eachKind<T>(of: (kind: MixKind) => T): Readonly<Record<MixKind, T>> {
  return Object.fromEntries(MIX_KINDS.map((kind) => [kind, of(kind)])) as Record<MixKind, T>;
}

/** Whether the Category is in the Edition's default Mix: always when the default is all. */
const inByDefault = ({ categoryIds }: DefaultMix, categoryId: string) =>
  categoryIds === 'all' || categoryIds.includes(categoryId);

/**
 * Whether the Category is in the Mix by the user's choice or, untouched, by
 * the Edition's default (ADR 0019).
 */
function inMixByChoice(edition: MixEdition, choices: MixChoices, categoryId: string): boolean {
  return (
    choices.categories.get(categoryId) ?? inByDefault(edition.userSettingDefaults.mix, categoryId)
  );
}

/** The Mix of the user's choices over the Edition's default Mix, for the Language Pack's Categories. */
function mixStateOf(
  categories: readonly Category[],
  edition: MixEdition,
  choices: MixChoices,
): MixState {
  const { mix } = edition.userSettingDefaults;
  let inMix: readonly Category[] = categories.filter(({ id }) =>
    inMixByChoice(edition, choices, id),
  );
  // At least one Category always stays in the Mix (ADR 0019). Taking out the last
  // one is refused, but a later default, a Category gone from the Language Pack or
  // a merge of two devices that each took out a different last one could still
  // leave none in; then the default's Categories are in, or every Category when
  // the pack has none of them. Nothing is written for it (ADR 0013).
  if (inMix.length === 0) inMix = categories.filter(({ id }) => inByDefault(mix, id));
  if (inMix.length === 0) inMix = categories;
  const categoryIds = inMix.map(({ id }) => id);
  return {
    allCategories: categories,
    categoryIds,
    kinds: eachKind((kind) => choices.kinds[kind] ?? KINDS[kind].byDefault(mix)),
    hiddenCategories: categories.filter(({ id }) => !categoryIds.includes(id)),
    lastCategoryId: categoryIds.length === 1 ? categoryIds[0] : undefined,
    rarityFloor: choices.rarityFloor ?? DEFAULT_RARITY_FLOOR,
  };
}

async function readChoices(userState: Pick<UserState, 'list' | 'read'>): Promise<MixChoices> {
  const [categories, rarityFloor, read] = await Promise.all([
    userState.list(categoryRecords),
    userState.read(rarityFloorRecord),
    Promise.all(MIX_KINDS.map((kind) => userState.read(KINDS[kind].record))),
  ]);
  return { categories, kinds: eachKind((kind) => read[MIX_KINDS.indexOf(kind)]), rarityFloor };
}

/**
 * Reads the Mix from the user state over the Edition's default Mix, for the
 * Entries, which read the Language Pack's Categories.
 */
export async function readMix({
  categories,
  edition,
  userState,
}: {
  categories: readonly Category[];
  edition: MixEdition;
  userState: Pick<UserState, 'list' | 'read'>;
}): Promise<MixState> {
  return mixStateOf(categories, edition, await readChoices(userState));
}

/**
 * Opens the Mix over the user state and the Language Pack's Categories, which
 * the Entries read once, as the pack never changes while it is open. For the
 * Core composition, which reads eligibility again in `eligibilityChanged`
 * after each change.
 */
export async function openMix({
  edition,
  categories,
  userState,
  eligibilityChanged,
}: {
  edition: MixEdition;
  categories: readonly Category[];
  userState: UserState;
  eligibilityChanged: () => Promise<void>;
}): Promise<Mix> {
  let choices = await readChoices(userState);
  let state = mixStateOf(categories, edition, choices);
  const subscribers = createSubscribers();

  const isCategory = (categoryId: string) => categories.some(({ id }) => id === categoryId);

  /**
   * Writes the new places in the Mix, then makes the change in memory:
   * eligibility first, so a subscriber told of the new state finds it read
   * again. The state follows the written change even when reading
   * eligibility again fails; the next change or the next app session reads
   * it again.
   */
  async function change(
    places: ReadonlyMap<string, boolean>,
    { kinds = state.kinds, rarityFloor = state.rarityFloor } = {},
  ): Promise<void> {
    const wanted = new Map<string, boolean>();
    // A Category in only because none would be otherwise is written in, so the
    // Mix stays as the reader sees it.
    for (const id of state.categoryIds) wanted.set(id, true);
    for (const [id, isIn] of places) wanted.set(id, isIn);
    const changed = new Map(choices.categories);
    const writes = new Map<string, string | undefined>();
    for (const [id, isIn] of wanted) {
      if (inMixByChoice(edition, choices, id) === isIn) continue;
      changed.set(id, isIn);
      for (const [key, value] of categoryRecords.record(id).change(isIn)) writes.set(key, value);
    }
    for (const kind of MIX_KINDS) {
      if (kinds[kind] === state.kinds[kind]) continue;
      for (const [key, value] of KINDS[kind].record.change(kinds[kind])) writes.set(key, value);
    }
    if (rarityFloor !== state.rarityFloor) {
      for (const [key, value] of rarityFloorRecord.change(rarityFloor)) writes.set(key, value);
    }
    if (writes.size === 0) return;
    await userState.write(writes);
    const next: MixChoices = {
      categories: changed,
      kinds: eachKind((kind) =>
        kinds[kind] === state.kinds[kind] ? choices.kinds[kind] : kinds[kind],
      ),
      rarityFloor: rarityFloor === state.rarityFloor ? choices.rarityFloor : rarityFloor,
    };
    try {
      await eligibilityChanged();
    } finally {
      choices = next;
      state = mixStateOf(categories, edition, next);
      subscribers.tell();
    }
  }

  async function takeOut(categoryId: string): Promise<boolean> {
    if (!isCategory(categoryId)) return false;
    if (!state.categoryIds.includes(categoryId)) return true;
    if (state.lastCategoryId === categoryId) return false;
    await change(new Map([[categoryId, false]]));
    return true;
  }

  async function putBack(categoryId: string): Promise<void> {
    if (!isCategory(categoryId) || state.categoryIds.includes(categoryId)) return;
    await change(new Map([[categoryId, true]]));
  }

  async function turnAllOn(): Promise<void> {
    await change(new Map(categories.map(({ id }) => [id, true])));
  }

  async function setKind(kind: MixKind, inMix: boolean): Promise<void> {
    await change(new Map(), { kinds: { ...state.kinds, [kind]: inMix } });
  }

  async function setRarityFloor(floor: number): Promise<void> {
    if (!RaritySchema.safeParse(floor).success) return;
    await change(new Map(), { rarityFloor: floor });
  }

  const inTurn = createInTurn();

  return {
    get state() {
      return state;
    },
    takeOut: (categoryId) => inTurn(() => takeOut(categoryId)),
    putBack: (categoryId) => inTurn(() => putBack(categoryId)),
    turnAllOn: () => inTurn(turnAllOn),
    setKind: (kind, inMix) => inTurn(() => setKind(kind, inMix)),
    setRarityFloor: (floor) => inTurn(() => setRarityFloor(floor)),
    subscribe: subscribers.subscribe,
  };
}
