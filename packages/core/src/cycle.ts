import type { Entries, EntryIds } from './entries';
import type { Random, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/**
 * A change of the Cycle not made yet: the user-state changes that keep it,
 * for the caller to write, alone or in one write with other changes, and the
 * step that makes it in memory once they are written. A change whose write
 * fails is never committed, so memory keeps what the user state keeps.
 */
export interface CycleChange {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written, and before the next change. */
  commit(): void;
}

/**
 * The current Cycle: every Entry it covers in an order shuffled with its seed,
 * and the Entries Seen in it. It is read from the user state once, when it
 * opens, and kept in memory after that, so open one per app session and share
 * it (ADR 0013). A change is made in memory only once the caller has written
 * it, see `CycleChange`.
 */
export interface Cycle {
  /** Every Entry the Cycle covers, each kind in the Cycle order. */
  order(): EntryIds;
  /** Whether the Cycle covers the Entry. */
  covers(entryId: string): boolean;
  /** Whether the Cycle covers no Entry at all. */
  isEmpty(): boolean;
  /** The Entries of the Cycle not Seen yet, each kind in the Cycle order. */
  unseen(): EntryIds;
  /** The change that makes the Entry Seen. It changes nothing when the Entry is Seen already. */
  markSeen(entryId: string): CycleChange;
  /**
   * The change that starts a new Cycle: nothing Seen, the Entries eligible
   * now, in a new shuffle from a new seed drawn from the random port. `order`
   * is the new Cycle's order.
   */
  start(): Promise<CycleChange & { readonly order: EntryIds }>;
}

const { cycle: cycleRecord, seen: seenRecords } = userStateRecords;

/** A seed for the shuffle of a new Cycle. */
function drawSeed(random: Random): number {
  return Math.floor(random.next() * 2 ** 32);
}

/**
 * The ids in an order that depends only on the seed (drawn one by one with
 * the mulberry32 generator), so a Cycle keeps its order across restarts.
 */
function shuffle(ids: readonly string[], seed: number): string[] {
  let state = seed >>> 0;
  function nextNumber(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  }
  const pool = [...ids];
  const order: string[] = [];
  while (pool.length > 0) order.push(...pool.splice(Math.floor(nextNumber() * pool.length), 1));
  return order;
}

/**
 * Opens the current Cycle, or starts the first one with a seed from the
 * random port. A Cycle covers the Entries eligible when it opens or starts,
 * and shuffles them with its seed.
 */
export async function openCycle({
  entries,
  userState,
  random,
}: {
  entries: Pick<Entries, 'eligible'>;
  userState: UserState;
  random: Random;
}): Promise<Cycle> {
  const stored = await userState.read(cycleRecord);
  let cycle = stored ?? { id: 1, seed: drawSeed(random) };
  if (stored === undefined) await userState.write(cycleRecord.change(cycle));
  async function orderOf(seed: number): Promise<EntryIds> {
    const { words, corrections } = await entries.eligible();
    return { words: shuffle(words, seed), corrections: shuffle(corrections, seed) };
  }
  let order = await orderOf(cycle.seed);
  const seen = new Set((await userState.list(seenRecords)).keys());

  return {
    order: () => order,
    covers: (entryId) => order.words.includes(entryId) || order.corrections.includes(entryId),
    isEmpty: () => order.words.length === 0 && order.corrections.length === 0,
    unseen: () => ({
      words: order.words.filter((id) => !seen.has(id)),
      corrections: order.corrections.filter((id) => !seen.has(id)),
    }),
    markSeen(entryId) {
      if (seen.has(entryId)) return { changes: new Map(), commit: () => undefined };
      return {
        changes: seenRecords.record(entryId).change(true),
        commit() {
          seen.add(entryId);
        },
      };
    },
    async start() {
      const started = { id: cycle.id + 1, seed: drawSeed(random) };
      const startedOrder = await orderOf(started.seed);
      // Every Seen record, also any kept by another Cycle over the user state.
      const seenIds = (await userState.list(seenRecords)).keys();
      return {
        order: startedOrder,
        changes: new Map([
          ...cycleRecord.change(started),
          ...[...seenIds].flatMap((id) => [...seenRecords.record(id).change(undefined)]),
        ]),
        commit() {
          cycle = started;
          order = startedOrder;
          seen.clear();
        },
      };
    },
  };
}
