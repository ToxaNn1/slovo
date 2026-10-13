import type { EntryRowModel, EntryRows } from './entry-row';
import type { UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

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
 * History: the Entries the Feed marked Seen, newest first, one entry per
 * Entry, the last `HISTORY_CAP`. It survives Cycles. Only the Feed records it,
 * in the same write as Seen, so opening an Entry from a list never does. It
 * is read from the user state once, when it opens, like the Cycle, so open
 * one per app session (the Core composition does). A change is made in
 * memory only once it is written.
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
   * Writes `changes` (the Feed's Seen mark) and the Entry's History entry in
   * one write, the Entry on top with the time it was Seen, evicting the
   * oldest beyond `HISTORY_CAP`.
   */
  record(
    seen: { readonly entryId: string; readonly seenAt: Date; readonly wordOfTheDay: boolean },
    changes: UserStateChanges,
  ): Promise<void>;
}

const { history: historyRecords } = userStateRecords;

/** A History entry as kept, with its row when the Language Pack has the Entry. */
type Kept = Omit<HistoryEntry, 'row'> & { readonly row: EntryRowModel | undefined };

/** Newest first; Entries Seen at the same instant in a stable order. */
function newestFirst(first: Kept, second: Kept): number {
  const byTime = second.seenAt.getTime() - first.seenAt.getTime();
  if (byTime !== 0) return byTime;
  return first.entryId < second.entryId ? -1 : 1;
}

/** Opens History over the user state, for the Core composition. */
export async function openHistory({
  rows,
  userState,
}: {
  rows: EntryRows;
  userState: UserState;
}): Promise<{ history: History; recorder: HistoryRecorder }> {
  const stored = await userState.list(historyRecords);
  // Every record counts towards the cap, also one whose Entry the Language Pack doesn't have.
  let kept: readonly Kept[] = (
    await Promise.all(
      [...stored].map(async ([entryId, { seenAt, wordOfTheDay }]) => ({
        entryId,
        seenAt: new Date(seenAt),
        wordOfTheDay,
        row: await rows.row(entryId),
      })),
    )
  ).sort(newestFirst);
  const listOf = (from: readonly Kept[]) =>
    from.filter((entry): entry is HistoryEntry => entry.row !== undefined);
  let list = listOf(kept);
  const listeners = new Set<() => void>();

  function changeKept(changed: readonly Kept[]): void {
    kept = changed;
    list = listOf(kept);
    for (const listener of listeners) listener();
  }

  // One change at a time, so each one starts from what the one before it left.
  let lastChange: Promise<unknown> = Promise.resolve();
  function inTurn<T>(change: () => Promise<T>): Promise<T> {
    const result = lastChange.then(change);
    lastChange = result.catch(() => undefined);
    return result;
  }

  async function record(
    { entryId, seenAt, wordOfTheDay }: Parameters<HistoryRecorder['record']>[0],
    changes: UserStateChanges,
  ): Promise<void> {
    const row = await rows.row(entryId);
    const others = kept.filter((entry) => entry.entryId !== entryId);
    const evicted = others.slice(HISTORY_CAP - 1);
    await userState.write(
      new Map([
        ...changes,
        ...evicted.flatMap((entry) => [...historyRecords.record(entry.entryId).change(undefined)]),
        ...historyRecords.record(entryId).change({ seenAt: seenAt.toISOString(), wordOfTheDay }),
      ]),
    );
    changeKept([{ entryId, seenAt, wordOfTheDay, row }, ...others.slice(0, HISTORY_CAP - 1)]);
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
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    recorder: {
      record: (seen, changes) => inTurn(() => record(seen, changes)),
    },
  };
}
