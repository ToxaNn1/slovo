import type { Edition } from '../edition/edition';
import type { KnowledgeMark } from '../knowledge/knowledge-record';
import type { UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** A change of one Community Counter: one taken away, none or one added. */
export type CounterChange = -1 | 0 | 1;

/** What one Entry's Community Counters change by: its known, unknown and saved counts. */
export interface CounterDelta {
  readonly known: CounterChange;
  readonly unknown: CounterChange;
  readonly saved: CounterChange;
}

/**
 * The Community Counters of this device (ADR 0060): the changes it counted
 * from the reader's own Knowledge Marks and Favorites, kept `device-only` until they are
 * sent.
 */
export interface CommunityCounters {
  /**
   * The changes counted and not yet sent, merged per Entry, by Entry id, read
   * afresh on each call. An Entry whose changes cancel out is not in it.
   */
  unsent(): Promise<ReadonlyMap<string, CounterDelta>>;
}

/** What this device counted for an Entry. */
interface Counted {
  readonly mark: KnowledgeMark | null;
  readonly saved: boolean;
}

const nothingCounted: Counted = { mark: null, saved: false };

const unchanged: CounterDelta = { known: 0, unknown: 0, saved: 0 };

/** One count's change from what was counted to what is: each is 0 or 1, so the change is −1, 0 or +1. */
const changeOf = (was: boolean, is: boolean): CounterChange => (was === is ? 0 : is ? 1 : -1);

/**
 * Two changes one after the other, merged. Each sums what was counted at two
 * moments, so the sum stays −1, 0 or +1 and none is ever lost.
 */
function merged(one: CounterDelta, other: CounterDelta): CounterDelta {
  const sum = (a: CounterChange, b: CounterChange): CounterChange => {
    const total = a + b;
    if (total !== -1 && total !== 0 && total !== 1) {
      throw new Error(`A merged counter change of ${String(total)}`);
    }
    return total;
  };
  return {
    known: sum(one.known, other.known),
    unknown: sum(one.unknown, other.unknown),
    saved: sum(one.saved, other.saved),
  };
}

const isUnchanged = (delta: CounterDelta) =>
  delta.known === 0 && delta.unknown === 0 && delta.saved === 0;

/**
 * Opens the Community Counters over the user state, for the Core composition,
 * with `countMark`, which the Knowledge Marks call when the reader taps a mark
 * on a card, the Yesterday card's included, and never for a Game answer, and
 * `countSaved`, which Favorites call when the reader adds or removes an Entry.
 */
export function openCommunityCounters({
  edition,
  userState,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
}): {
  communityCounters: CommunityCounters;
  /**
   * The changes to write with the Entry's new mark, none for no mark, that
   * count the difference between what this device counted and the mark: a
   * new mark adds one, a move Known ↔ Unknown moves one, removing a mark this
   * device counted takes one away. A mark from before the update was never
   * counted, so removing it changes nothing and changing it counts as new.
   * None with the `communityCounters` Feature Switch off.
   */
  countMark: (entryId: string, mark: KnowledgeMark | undefined) => Promise<UserStateChanges>;
  /**
   * The changes to write with the Entry going into Favorites or out of them,
   * by the same rule: adding it saves one, removing an Entry this device
   * counted saved takes one away. A Favorite from before the update was never
   * counted, so removing it changes nothing and adding it again counts as new.
   * None with the `communityCounters` Feature Switch off.
   */
  countSaved: (entryId: string, saved: boolean) => Promise<UserStateChanges>;
} {
  const { countersCounted, countersUnsent } = userStateRecords;

  /** The changes that count the Entry as `next` gives it from what this device counted. */
  async function count(
    entryId: string,
    next: (counted: Counted) => Counted,
  ): Promise<UserStateChanges> {
    if (!edition.isFeatureEnabled('communityCounters')) return new Map();
    const counted = (await userState.read(countersCounted.record(entryId))) ?? nothingCounted;
    const is = next(counted);
    const delta: CounterDelta = {
      known: changeOf(counted.mark === 'known', is.mark === 'known'),
      unknown: changeOf(counted.mark === 'unknown', is.mark === 'unknown'),
      saved: changeOf(counted.saved, is.saved),
    };
    if (isUnchanged(delta)) return new Map();
    const unsent = merged(
      (await userState.read(countersUnsent.record(entryId))) ?? unchanged,
      delta,
    );
    return new Map([
      ...countersCounted.record(entryId).change(is.mark === null && !is.saved ? undefined : is),
      ...countersUnsent.record(entryId).change(isUnchanged(unsent) ? undefined : unsent),
    ]);
  }

  return {
    communityCounters: { unsent: () => userState.list(countersUnsent) },
    countMark: (entryId, mark) => count(entryId, (counted) => ({ ...counted, mark: mark ?? null })),
    countSaved: (entryId, saved) => count(entryId, (counted) => ({ ...counted, saved })),
  };
}
