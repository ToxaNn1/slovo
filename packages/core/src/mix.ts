import type { Category } from '@slovo/contracts';

import type { Edition, UserSettingDefaults } from './edition';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** What the Mix needs to know of the Edition: its Categories and its default Mix. */
export type MixEdition = Pick<Edition, 'categories'> & {
  readonly userSettingDefaults: Pick<UserSettingDefaults, 'mix'>;
};

/** The Mix as it stands. */
export interface MixState {
  /** The Categories in the Mix, by id, in the Edition's order. */
  readonly categoryIds: readonly string[];
  /** Whether Corrections, as a whole, are in the Mix. */
  readonly corrections: boolean;
  /** The Hidden Categories: the Categories out of the Mix, in the Edition's order (ADR 0019). */
  readonly hiddenCategories: readonly Category[];
  /** The one Category left in the Mix, which can't be taken out; nothing while more are in. */
  readonly lastCategoryId: string | undefined;
}

/**
 * The Mix: the Categories, plus Corrections as a whole, the user chose to see
 * in everything new. A Category out of the Mix is a Hidden Category, so the
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
   * refused, and so is a Category the Edition doesn't have.
   */
  takeOut(categoryId: string): Promise<boolean>;
  /** Puts the Category back in the Mix. A Category the Edition doesn't have is skipped. */
  putBack(categoryId: string): Promise<void>;
  /** Puts every Category in the Mix at once. Corrections stay as they are. */
  turnAllOn(): Promise<void>;
  /** Puts Corrections, as a whole, in the Mix or takes them out. */
  setCorrections(inMix: boolean): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { mixCategories: categoryRecords, mixCorrections: correctionsRecord } = userStateRecords;

/** The places in the Mix the user chose: by Category id, and for Corrections. */
interface MixChoices {
  readonly categories: ReadonlyMap<string, boolean>;
  readonly corrections: boolean | undefined;
}

/**
 * Whether the Category is in the Mix by the user's choice or, untouched, by
 * the Edition's default (ADR 0019).
 */
function inMixByChoice(edition: MixEdition, choices: MixChoices, categoryId: string): boolean {
  return (
    choices.categories.get(categoryId) ??
    edition.userSettingDefaults.mix.categoryIds.includes(categoryId)
  );
}

/** The Mix of the user's choices over the Edition's default Mix. */
function mixStateOf(edition: MixEdition, choices: MixChoices): MixState {
  const { mix } = edition.userSettingDefaults;
  let inMix = edition.categories.filter(({ id }) => inMixByChoice(edition, choices, id));
  // At least one Category always stays in the Mix (ADR 0019). Taking out the last
  // one is refused, but a later default or a Category gone from the Edition could
  // still leave none in; then the default's Categories are in.
  if (inMix.length === 0) {
    inMix = edition.categories.filter(({ id }) => mix.categoryIds.includes(id));
  }
  const categoryIds = inMix.map(({ id }) => id);
  return {
    categoryIds,
    corrections: choices.corrections ?? mix.corrections,
    hiddenCategories: edition.categories.filter(({ id }) => !categoryIds.includes(id)),
    lastCategoryId: categoryIds.length === 1 ? categoryIds[0] : undefined,
  };
}

async function readChoices(userState: Pick<UserState, 'list' | 'read'>): Promise<MixChoices> {
  const [categories, corrections] = await Promise.all([
    userState.list(categoryRecords),
    userState.read(correctionsRecord),
  ]);
  return { categories, corrections };
}

/** Reads the Mix from the user state over the Edition's default Mix, for the Entries. */
export async function readMix({
  edition,
  userState,
}: {
  edition: MixEdition;
  userState: Pick<UserState, 'list' | 'read'>;
}): Promise<MixState> {
  return mixStateOf(edition, await readChoices(userState));
}

/**
 * Opens the Mix over the user state, for the Core composition, which reads
 * eligibility again in `eligibilityChanged` after each change.
 */
export async function openMix({
  edition,
  userState,
  eligibilityChanged,
}: {
  edition: MixEdition;
  userState: UserState;
  eligibilityChanged: () => Promise<void>;
}): Promise<Mix> {
  let choices = await readChoices(userState);
  let state = mixStateOf(edition, choices);
  const listeners = new Set<() => void>();

  const isCategory = (categoryId: string) => edition.categories.some(({ id }) => id === categoryId);

  /**
   * Writes the new places in the Mix, then makes the change in memory:
   * eligibility first, so a subscriber told of the new state finds it read
   * again. The state follows the written change even when reading
   * eligibility again fails; the next change or the next app session reads
   * it again.
   */
  async function change(
    categories: ReadonlyMap<string, boolean>,
    corrections = state.corrections,
  ): Promise<void> {
    const wanted = new Map<string, boolean>();
    // A Category in only because none would be otherwise is written in, so the
    // Mix stays as the reader sees it.
    for (const id of state.categoryIds) wanted.set(id, true);
    for (const [id, isIn] of categories) wanted.set(id, isIn);
    const changed = new Map(choices.categories);
    const writes = new Map<string, string | undefined>();
    for (const [id, isIn] of wanted) {
      if (inMixByChoice(edition, choices, id) === isIn) continue;
      changed.set(id, isIn);
      for (const [key, value] of categoryRecords.record(id).change(isIn)) writes.set(key, value);
    }
    if (corrections !== state.corrections) {
      for (const [key, value] of correctionsRecord.change(corrections)) writes.set(key, value);
    }
    if (writes.size === 0) return;
    await userState.write(writes);
    const next: MixChoices = {
      categories: changed,
      corrections: corrections === state.corrections ? choices.corrections : corrections,
    };
    try {
      await eligibilityChanged();
    } finally {
      choices = next;
      state = mixStateOf(edition, next);
      for (const listener of listeners) listener();
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
    await change(new Map(edition.categories.map(({ id }) => [id, true])));
  }

  async function setCorrections(inMix: boolean): Promise<void> {
    await change(new Map(), inMix);
  }

  // One change at a time, so each one starts from what the one before it left.
  let lastChange: Promise<unknown> = Promise.resolve();
  function inTurn<T>(change: () => Promise<T>): Promise<T> {
    const result = lastChange.then(change);
    lastChange = result.catch(() => undefined);
    return result;
  }

  return {
    get state() {
      return state;
    },
    takeOut: (categoryId) => inTurn(() => takeOut(categoryId)),
    putBack: (categoryId) => inTurn(() => putBack(categoryId)),
    turnAllOn: () => inTurn(turnAllOn),
    setCorrections: (inMix) => inTurn(() => setCorrections(inMix)),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
