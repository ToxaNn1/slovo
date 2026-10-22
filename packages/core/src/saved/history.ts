import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import { createInTurn, createSubscribers, newestFirst } from '../in-turn';
import type { UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** How many Entries History keeps: the next one evicts the oldest. */
export const HISTORY_CAP = 500;

/** An Entry in History. */
export interface HistoryEntry {
  readonly entryId: string;
  /** When the Feed last marked it Seen. */
  readonly seenAt: Date;
  /** Whether it was Seen on the Word of the Day's card. */
  readonly wordOfTheDay: boolean;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

/**
 * History: the Entries marked Seen, newest first, one entry per Entry, the
 * last `HISTORY_CAP`. It survives Cycles. Only the Feed records it, in the
 * same write as Seen: for a card that stayed on screen, or a Word opened from
 * a notification. Opening an Entry from a list never does. It is read from
 * the user state once, when it opens, like the Cycle, so open one per app
 * session (the Core composition does). A change is made in memory only once
 * it is written.
 */
export interface History {
  /**
   * The Entries in History, newest first; its length is the count. An id the
   * Language Pack doesn't have is left out. A change never edits this array:
   * it makes a new one and tells the subscribers, so the array stays the same
   * until something changes.
   */
  readonly list: readonly HistoryEntry[];
  /** Deletes every History record at once, and nothing else. */
  clear(): Promise<void>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** How the Feed records History in its Seen write; the shell never gets it. */
export interface HistoryRecorder {
  /**
   * Writes `changes` (the Feed's new Seen mark) and the Entry's History entry
   * in one write, the Entry with the time it was Seen, which puts it on top
   * unless the clock went back, evicting the oldest beyond `HISTORY_CAP`.
   */
  record(seen: Seen, changes: UserStateChanges): Promise<void>;
}

/** An Entry the Feed marked Seen: a History entry without its row. */
export type Seen = Omit<HistoryEntry, 'row'>;

const { history: historyRecords } = userStateRecords;

/** A History entry as kept, with its row when the Language Pack has the Entry. */
type Kept = Seen & { readonly row: EntryRowModel | undefined };

const newestKept = newestFirst<Kept>(
  (entry) => entry.seenAt,
  (entry) => entry.entryId,
);

/** Opens History over the user state, for the Core composition. */
export async function openHistory({
  rows,
  userState,
}: {
  rows: EntryRows;
  userState: UserState;
}): Promise<{ history: History; recorder: HistoryRecorder }> {
  const stored = await userState.list(historyRecords);
  const rowOf = await rows.rows(stored.keys());
  // Every record counts towards the cap, also one whose Entry the Language Pack doesn't have.
  let kept: readonly Kept[] = [...stored]
    .map(([entryId, { seenAt, wordOfTheDay }]) => ({
      entryId,
      seenAt: new Date(seenAt),
      wordOfTheDay,
      row: rowOf.get(entryId),
    }))
    .sort(newestKept);
  const listOf = (from: readonly Kept[]) =>
    from.filter((entry): entry is HistoryEntry => entry.row !== undefined);
  let list = listOf(kept);
  const subscribers = createSubscribers();

  function changeKept(changed: readonly Kept[]): void {
    kept = changed;
    list = listOf(kept);
    subscribers.tell();
  }

  const inTurn = createInTurn();

  async function record(
    { entryId, seenAt, wordOfTheDay }: Seen,
    changes: UserStateChanges,
  ): Promise<void> {
    const row = await rows.row(entryId);
    const others = kept.filter((entry) => entry.entryId !== entryId);
    // In its place by Seen time, as reopening and the Sync's trim order it,
    // also when the clock went back or a synced entry is ahead of it.
    const found = others.findIndex((entry) => entry.seenAt.getTime() <= seenAt.getTime());
    const at = found === -1 ? others.length : found;
    const all = [
      ...others.slice(0, at),
      { entryId, seenAt, wordOfTheDay, row },
      ...others.slice(at),
    ];
    const evicted = all.slice(HISTORY_CAP);
    await userState.write(
      new Map([
        ...changes,
        ...historyRecords.record(entryId).change({ seenAt: seenAt.toISOString(), wordOfTheDay }),
        ...evicted.flatMap((entry) => [...historyRecords.record(entry.entryId).change(undefined)]),
      ]),
    );
    changeKept(all.slice(0, HISTORY_CAP));
  }

  async function clear(): Promise<void> {
    // Every History record, also any this app session never read.
    const ids = new Set([
      ...(await userState.list(historyRecords)).keys(),
      ...kept.map((entry) => entry.entryId),
    ]);
    if (ids.size === 0) return;
    await userState.write(
      new Map([...ids].flatMap((id) => [...historyRecords.record(id).change(undefined)])),
    );
    changeKept([]);
  }

  return {
    history: {
      get list() {
        return list;
      },
      clear: () => inTurn(clear),
      subscribe: subscribers.subscribe,
    },
    recorder: {
      record: (seen, changes) => inTurn(() => record(seen, changes)),
    },
  };
}
