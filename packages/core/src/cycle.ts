import type { Entries, EntryIds } from './entries';
import type { Random, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/**
 * The current Cycle: every Entry it covers in an order shuffled with its seed,
 * and the Entries Seen in it. It is read from the user state once, when it
 * opens, and kept in memory after that, so open one per app session and share
 * it. A change returns the user-state changes that keep it, for the caller to
 * write, so it can go in one write with other changes.
 */
export interface Cycle {
  /** Every Entry the Cycle covers, each kind in the Cycle order. */
  order(): EntryIds;
  /** The Entries of the Cycle not Seen yet, each kind in the Cycle order. */
  unseen(): EntryIds;
  /** Makes the Entry Seen in the Cycle. Returns no changes when it was Seen already. */
  markSeen(entryId: string): UserStateChanges;
  /**
   * Starts a new Cycle: nothing Seen, the Entries eligible now, in a new
   * shuffle from a new seed drawn from the random port.
   */
  start(): Promise<UserStateChanges>;
}

const { cycle: cycleRecord, seen: seenRecord } = userStateRecords;

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
  const seen = new Set(await userState.read(seenRecord));

  return {
    order: () => order,
    unseen: () => ({
      words: order.words.filter((id) => !seen.has(id)),
      corrections: order.corrections.filter((id) => !seen.has(id)),
    }),
    markSeen(entryId) {
      if (seen.has(entryId)) return new Map();
      seen.add(entryId);
      return seenRecord.change([...seen]);
    },
    async start() {
      cycle = { id: cycle.id + 1, seed: drawSeed(random) };
      order = await orderOf(cycle.seed);
      seen.clear();
      return new Map([...cycleRecord.change(cycle), ...seenRecord.change(undefined)]);
    },
  };
}
