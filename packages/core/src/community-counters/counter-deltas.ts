import type { Edition } from '../edition/edition';
import type { KnowledgeMark } from '../knowledge/knowledge-record';
import type { CounterChange, CounterDelta, CounterEvent, UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

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
  /**
   * The changes to write with the Entry's new mark, none for no mark, that
   * count the difference between what this device counted and the mark: a
   * new mark adds one, a move Known ↔ Unknown moves one, removing a mark this
   * device counted takes one away. A mark from before the update was never
   * counted, so removing it changes nothing and changing it counts as new.
   * None with the `communityCounters` Feature Switch off or sharing off. The
   * Knowledge Marks call it when the reader taps a mark on a card, the
   * Yesterday card's included, and never for a Game answer.
   */
  countMark(entryId: string, mark: KnowledgeMark | undefined): Promise<UserStateChanges>;
  /**
   * The changes to write with the Entry going into Favorites or out of them,
   * by the same rule: adding it saves one, removing an Entry this device
   * counted saved takes one away. A Favorite from before the update was never
   * counted, so removing it changes nothing and adding it again counts as new.
   * None with the `communityCounters` Feature Switch off or sharing off.
   * Favorites call it when the reader adds or removes an Entry.
   */
  countSaved(entryId: string, saved: boolean): Promise<UserStateChanges>;
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

/** The sum of two changes of one count, if it is a change: −1, 0 or +1. */
function sumOf(a: CounterChange, b: CounterChange): CounterChange | undefined {
  const total = a + b;
  return total === -1 || total === 0 || total === 1 ? total : undefined;
}

/** The sum of two deltas, if each of its counts is a change. */
function sumOfDeltas(one: CounterDelta, other: CounterDelta): CounterDelta | undefined {
  const known = sumOf(one.known, other.known);
  const unknown = sumOf(one.unknown, other.unknown);
  const saved = sumOf(one.saved, other.saved);
  return known === undefined || unknown === undefined || saved === undefined
    ? undefined
    : { known, unknown, saved };
}

/**
 * Two changes one after the other, merged. Each sums what was counted at two
 * moments, so the sum stays −1, 0 or +1 and none is ever lost.
 */
function merged(one: CounterDelta, other: CounterDelta): CounterDelta {
  const sum = sumOfDeltas(one, other);
  if (sum === undefined) {
    throw new Error(`Merged counter changes out of range: ${JSON.stringify([one, other])}`);
  }
  return sum;
}

/** A change the other way. */
const opposite = (change: CounterChange): CounterChange =>
  change === 1 ? -1 : change === -1 ? 1 : 0;

const negated = (delta: CounterDelta): CounterDelta => ({
  known: opposite(delta.known),
  unknown: opposite(delta.unknown),
  saved: opposite(delta.saved),
});

const isUnchanged = (delta: CounterDelta) =>
  delta.known === 0 && delta.unknown === 0 && delta.saved === 0;

/** Opens the Community Counters over the user state, for the Core composition. */
export function openCommunityCounters({
  edition,
  userState,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
}): CommunityCounters {
  const { countersCounted, countersUnsent } = userStateRecords;

  /** The changes that count the Entry as `next` gives it from what this device counted. */
  async function count(
    entryId: string,
    next: (counted: Counted) => Counted,
  ): Promise<UserStateChanges> {
    if (!edition.isFeatureEnabled('communityCounters')) return new Map();
    if ((await userState.read(userStateRecords.shareCounters)) === false) return new Map();
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
    unsent: () => userState.list(countersUnsent),
    countMark: (entryId, mark) => count(entryId, (counted) => ({ ...counted, mark: mark ?? null })),
    countSaved: (entryId, saved) => count(entryId, (counted) => ({ ...counted, saved })),
  };
}

/**
 * The changes that forget what waits to be sent, for turning sharing off
 * (ADR 0060): each unsent change goes, and what this device counted goes
 * back to what it had sent, so a later change counts from there.
 */
export async function forgetUnsentCounters(
  userState: Pick<UserState, 'read' | 'list'>,
): Promise<UserStateChanges> {
  const { countersCounted, countersUnsent } = userStateRecords;
  const changes = new Map<string, string | undefined>();
  for (const [entryId, unsent] of await userState.list(countersUnsent)) {
    const counted = (await userState.read(countersCounted.record(entryId))) ?? nothingCounted;
    const was = (is: boolean, change: CounterChange) => (is ? 1 : 0) - change === 1;
    const sent: Counted = {
      mark: was(counted.mark === 'known', unsent.known)
        ? 'known'
        : was(counted.mark === 'unknown', unsent.unknown)
          ? 'unknown'
          : null,
      saved: was(counted.saved, unsent.saved),
    };
    for (const change of [
      ...countersCounted
        .record(entryId)
        .change(sent.mark === null && !sent.saved ? undefined : sent),
      ...countersUnsent.record(entryId).change(undefined),
    ]) {
      changes.set(...change);
    }
  }
  return changes;
}

/**
 * The changes that take what a request sent off the unsent changes, keeping
 * what was counted while it was out. An Entry whose unsent change no longer
 * holds what was sent, as after sharing went off and on again, keeps its own.
 */
export async function unsentAfterSending(
  userState: Pick<UserState, 'read'>,
  events: readonly CounterEvent[],
): Promise<UserStateChanges> {
  const { countersUnsent } = userStateRecords;
  const changes = new Map<string, string | undefined>();
  for (const { entryId, ...sent } of events) {
    const unsent = await userState.read(countersUnsent.record(entryId));
    if (unsent === undefined) continue;
    const rest = sumOfDeltas(unsent, negated(sent));
    if (rest === undefined) continue;
    for (const change of countersUnsent
      .record(entryId)
      .change(isUnchanged(rest) ? undefined : rest)) {
      changes.set(...change);
    }
  }
  return changes;
}
