import type { Entries, EntryIds } from '../entries/entries';
import type { Random, UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

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
 * it, see `CycleChange`. When eligibility changes, it reads the eligible
 * Entries again (ADR 0015).
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
  /**
   * Reads the eligible Entries again, once eligibility has changed (a Hidden
   * Entry, the Mix), and covers those from now on. The seed and what is Seen
   * stay, and so does the order of the Entries that stay: an Entry eligible
   * again takes back its place. It writes nothing. Of reads that overlap,
   * here or in `start`, the one asked for last wins.
   */
  readEligibleAgain(): Promise<void>;
}

const { cycle: cycleRecord, seen: seenRecords } = userStateRecords;

/** A seed for the shuffle of a new Cycle. */
function drawSeed(random: Random): number {
  return Math.floor(random.next() * 2 ** 32);
}

/** The value with its bits mixed by the murmur3 finalizer. */
function mix(value: number): number {
  let hash = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** The place of the id in a shuffle with the seed: an FNV-1a hash of the id that starts from the seed. */
function rank(id: string, seed: number): number {
  let hash = mix(seed);
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 0x01000193);
  }
  return mix(hash);
}

/**
 * The ids in an order that depends only on the seed and each id, so a Cycle
 * keeps its order across restarts, and the ids that stay keep theirs when
 * some leave or come back.
 */
function shuffle(ids: readonly string[], seed: number): string[] {
  const ranked = ids.map((id) => ({ id, rank: rank(id, seed) }));
  ranked.sort((first, second) => first.rank - second.rank || (first.id < second.id ? -1 : 1));
  return ranked.map(({ id }) => id);
}

const orderOf = ({ words, corrections, idioms }: EntryIds, seed: number): EntryIds => ({
  words: shuffle(words, seed),
  corrections: shuffle(corrections, seed),
  idioms: shuffle(idioms, seed),
});

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
  let order = orderOf(await entries.eligible(), cycle.seed);
  // Only the marks of this Cycle; one of another Cycle reads as not Seen.
  const seen = new Set(
    [...(await userState.list(seenRecords))].flatMap(([id, seenIn]) =>
      seenIn === cycle.id ? [id] : [],
    ),
  );

  // Each read of the eligible Entries is numbered as it is asked for, and the
  // Cycle keeps what the last one asked for read, whichever ends last.
  let readsAsked = 0;
  let readKept = 0;
  async function readEligible(): Promise<{ eligible: EntryIds; keepIfLatest(): boolean }> {
    const asked = (readsAsked += 1);
    const eligible = await entries.eligible();
    return {
      eligible,
      keepIfLatest() {
        if (asked < readKept) return false;
        readKept = asked;
        return true;
      },
    };
  }

  return {
    order: () => order,
    covers: (entryId) =>
      order.words.includes(entryId) ||
      order.corrections.includes(entryId) ||
      order.idioms.includes(entryId),
    isEmpty: () =>
      order.words.length === 0 && order.corrections.length === 0 && order.idioms.length === 0,
    unseen: () => ({
      words: order.words.filter((id) => !seen.has(id)),
      corrections: order.corrections.filter((id) => !seen.has(id)),
      idioms: order.idioms.filter((id) => !seen.has(id)),
    }),
    markSeen(entryId) {
      if (seen.has(entryId)) return { changes: new Map(), commit: () => undefined };
      return {
        changes: seenRecords.record(entryId).change(cycle.id),
        commit() {
          seen.add(entryId);
        },
      };
    },
    async start() {
      const started = { id: cycle.id + 1, seed: drawSeed(random) };
      const read = await readEligible();
      const startedOrder = orderOf(read.eligible, started.seed);
      // Every Seen record, also any kept by another Cycle over the user state
      // or brought from another Cycle by a device.
      const seenIds = (await userState.list(seenRecords)).keys();
      return {
        order: startedOrder,
        changes: new Map([
          ...cycleRecord.change(started),
          ...[...seenIds].flatMap((id) => [...seenRecords.record(id).change(undefined)]),
        ]),
        commit() {
          // Entries read again since are covered with the new seed.
          order = read.keepIfLatest() ? startedOrder : orderOf(order, started.seed);
          cycle = started;
          seen.clear();
        },
      };
    },
    async readEligibleAgain() {
      const read = await readEligible();
      if (read.keepIfLatest()) order = orderOf(read.eligible, cycle.seed);
    },
  };
}
