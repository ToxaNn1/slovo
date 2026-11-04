import { RaritySchema, type Rarity } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { rarityCeiling: record } = userStateRecords;

/** The highest rarity, at which every Word is within the Rarity Ceiling. */
const HIGHEST: Rarity = 5;

/** What the Rarity Ceiling needs of the Edition: its switch and its default. */
export type RarityCeilingEdition = Pick<Edition, 'isFeatureEnabled' | 'userSettingDefaults'>;

/**
 * The Rarity Ceiling (ADR 0072): the one «Рідкість» setting, «до 1» to
 * «до 5», that every surface obeys: the Feed, the notifications, the
 * widgets, every Game Mode and the Daily Crossword show no Word above it.
 * The Rarity Test and the onboarding set it through `set` too.
 */
export interface RarityCeiling {
  /** The Rarity Ceiling in force: the user's, or the Edition's default; «до 5» while the switch is off. */
  readonly state: Rarity;
  /**
   * Sets the Rarity Ceiling and publishes `eligibility`. A ceiling that is
   * not a rarity, a whole number from 1 to 5, is skipped, and so is any while
   * the Edition turns the rarityCeiling switch off (or a remote switch does).
   */
  set(ceiling: number): Promise<void>;
  /** Tells of each change of `state`, after it. */
  subscribe(listener: () => void): () => void;
}

/** Whether a Word of the rarity is within the Rarity Ceiling: the one rule every surface filters by. */
export function withinRarityCeiling(rarity: Rarity, ceiling: Rarity): boolean {
  return rarity <= ceiling;
}

/**
 * The Rarity Ceiling in force, read afresh: the user's record, or the
 * Edition's default without one; «до 5», so every Word is within it, while
 * the Edition turns the rarityCeiling switch off, as before 1.0.
 */
export async function readRarityCeiling({
  edition,
  userState,
}: {
  edition: RarityCeilingEdition;
  userState: Pick<UserState, 'read'>;
}): Promise<Rarity> {
  if (!edition.isFeatureEnabled('rarityCeiling')) return HIGHEST;
  return (await userState.read(record)) ?? edition.userSettingDefaults.rarityCeiling;
}

/**
 * Opens the Rarity Ceiling over the user state for the Core composition:
 * each change publishes `eligibility`, so the Cycle reads the eligible
 * Entries again and the Feed, the plan and the Game follow.
 */
export async function openRarityCeiling({
  edition,
  userState,
  eligibility,
}: {
  edition: RarityCeilingEdition;
  userState: Pick<UserState, 'read' | 'write'>;
  eligibility: Pick<Subject<void>, 'publish'>;
}): Promise<RarityCeiling> {
  let state = await readRarityCeiling({ edition, userState });
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  async function set(ceiling: number): Promise<void> {
    const rarity = RaritySchema.safeParse(ceiling);
    if (!rarity.success || !edition.isFeatureEnabled('rarityCeiling')) return;
    if (rarity.data === state) return;
    await userState.write(record.change(rarity.data));
    state = rarity.data;
    subscribers.tell();
    await eligibility.publish();
  }

  return {
    get state() {
      return state;
    },
    set: (ceiling) => inTurn(() => set(ceiling)),
    subscribe: subscribers.subscribe,
  };
}
