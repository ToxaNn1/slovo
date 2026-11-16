import { RarityRangeSchema, type Rarity, type RarityRange } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { rarityRange: record } = userStateRecords;

/** The lowest rarity, the bottom of every Rarity Range while the `rarityRange` switch is off. */
export const LOWEST_RARITY: Rarity = 1;

/** The highest rarity, at which every Word is within a Rarity Range from 1. */
export const HIGHEST_RARITY: Rarity = 5;

/** The Rarity Range of every Word, «від 1 до 5». */
export const EVERY_RARITY: RarityRange = { from: LOWEST_RARITY, to: HIGHEST_RARITY };

/** What the Rarity Range needs of the Edition: its switches and its default top. */
export type RarityRangeEdition = Pick<Edition, 'isFeatureEnabled' | 'userSettingDefaults'>;

/**
 * The Rarity Range setting (ADR 0156): «Рідкість», «від 1 до 5» to «лише 3»,
 * that every surface obeys: the Feed, the notifications, the widgets, every
 * Game Mode and the Daily Crossword show no Word outside it. The Rarity Test
 * and the onboarding set it through `set` too, from 1.
 */
export interface RarityRangeSetting {
  /**
   * The Rarity Range in force: the user's, or from 1 to the Edition's default
   * top; from 1 while the `rarityRange` switch is off; every rarity while the
   * `rarityCeiling` switch is off.
   */
  readonly state: RarityRange;
  /**
   * Sets the Rarity Range and publishes `eligibility`. A range whose ends are
   * not rarities, whole numbers from 1 to 5, or whose `from` is above its
   * `to`, is skipped, and so is any while the Edition turns the
   * `rarityCeiling` switch off (or a remote switch does). While the
   * `rarityRange` switch is off, the range is taken from 1.
   */
  set(range: { from: number; to: number }): Promise<void>;
  /** Tells of each change of `state`, after it. */
  subscribe(listener: () => void): () => void;
}

/** Whether a Word of the rarity is within the Rarity Range: the one rule every surface filters by. */
export function withinRarityRange(rarity: Rarity, { from, to }: RarityRange): boolean {
  return from <= rarity && rarity <= to;
}

/** Whether the Rarity Range holds every rarity, so filtering by it changes nothing. */
export function holdsEveryRarity({ from, to }: RarityRange): boolean {
  return from === LOWEST_RARITY && to === HIGHEST_RARITY;
}

/**
 * Opens the Rarity Range over the user state for the Core composition: each
 * change publishes `eligibility`, so the Cycle reads the eligible Entries
 * again and the Feed, the plan and the Game follow.
 */
export async function openRarityRange({
  edition,
  userState,
  eligibility,
}: {
  edition: RarityRangeEdition;
  userState: Pick<UserState, 'read' | 'write'>;
  eligibility: Pick<Subject<void>, 'publish'>;
}): Promise<RarityRangeSetting> {
  const isOn = () => edition.isFeatureEnabled('rarityCeiling');
  // The bottom is obeyed only while the picker that sets it is on.
  const inForce = (range: RarityRange): RarityRange =>
    edition.isFeatureEnabled('rarityRange') ? range : { from: LOWEST_RARITY, to: range.to };
  // Every rarity, as before 1.0, while the Edition turns the switch off.
  let state = isOn()
    ? inForce(
        (await userState.read(record)) ?? {
          from: LOWEST_RARITY,
          to: edition.userSettingDefaults.rarityCeiling,
        },
      )
    : EVERY_RARITY;
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  async function set(next: { from: number; to: number }): Promise<void> {
    const range = RarityRangeSchema.safeParse(next);
    if (!range.success || !isOn()) return;
    const kept = inForce(range.data);
    if (kept.from === state.from && kept.to === state.to) return;
    await userState.write(record.change(kept));
    state = kept;
    // Eligibility is read again before the subscribers are told, as the Mix
    // does, so a subscriber told of the new range finds it read again.
    try {
      await eligibility.publish();
    } finally {
      subscribers.tell();
    }
  }

  return {
    get state() {
      return state;
    },
    set: (range) => inTurn(() => set(range)),
    subscribe: subscribers.subscribe,
  };
}
