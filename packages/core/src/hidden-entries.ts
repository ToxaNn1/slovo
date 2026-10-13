import type { EntryRowModel, EntryRows } from './entry-row';
import type { Clock } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** An Entry the user hid. */
export interface HiddenEntry {
  readonly entryId: string;
  /** When the user hid it. */
  readonly hiddenAt: Date;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

/**
 * The Hidden Entries: the Entries the user doesn't want to see, which are
 * eligible nowhere until restored (ADR 0015). Hiding an Entry leaves it
 * wherever the user keeps it. Read from the user state once, when it opens,
 * like the Cycle, so open one per app session (the Core composition does). A
 * change is made in memory only once it is written.
 */
export interface HiddenEntries {
  /**
   * The Hidden Entries, newest first; its length is the count. An id the
   * Language Pack doesn't have is left out. A change never edits this array:
   * it makes a new one and tells the subscribers, so the array stays the same
   * until something changes.
   */
  readonly list: readonly HiddenEntry[];
  /** Whether the Entry is Hidden. */
  has(entryId: string): boolean;
  /**
   * Hides the Entry, as of now. A Hidden Entry keeps the time it was hidden,
   * and an id the Language Pack doesn't have is skipped.
   */
  hide(entryId: string): Promise<void>;
  /** Makes a Hidden Entry eligible again. It is also the undo of a hide. */
  restore(entryId: string): Promise<void>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { hidden: hiddenRecords } = userStateRecords;

/** Newest first; Entries hidden at the same instant in a stable order. */
function newestFirst(first: HiddenEntry, second: HiddenEntry): number {
  const byTime = second.hiddenAt.getTime() - first.hiddenAt.getTime();
  if (byTime !== 0) return byTime;
  return first.entryId < second.entryId ? -1 : 1;
}

/**
 * Opens the Hidden Entries over the user state, for the Core composition,
 * which reads eligibility again in `eligibilityChanged` after each change.
 */
export async function openHiddenEntries({
  rows,
  userState,
  clock,
  eligibilityChanged,
}: {
  rows: EntryRows;
  userState: UserState;
  clock: Clock;
  eligibilityChanged: () => Promise<void>;
}): Promise<HiddenEntries> {
  const stored = await userState.list(hiddenRecords);
  const kept = await Promise.all(
    [...stored].map(async ([entryId, hidden]): Promise<HiddenEntry | undefined> => {
      const row = await rows.row(entryId);
      return row === undefined ? undefined : { entryId, hiddenAt: new Date(hidden), row };
    }),
  );
  let list: readonly HiddenEntry[] = kept
    .filter((hiddenEntry): hiddenEntry is HiddenEntry => hiddenEntry !== undefined)
    .sort(newestFirst);
  const listeners = new Set<() => void>();

  /**
   * Makes the written change in memory: eligibility first, so a subscriber
   * told of the new list finds it read again.
   */
  async function changeList(changed: readonly HiddenEntry[]): Promise<void> {
    try {
      await eligibilityChanged();
    } finally {
      list = changed;
      for (const listener of listeners) listener();
    }
  }

  const has = (entryId: string) => list.some((hiddenEntry) => hiddenEntry.entryId === entryId);

  async function hide(entryId: string): Promise<void> {
    if (has(entryId)) return;
    const row = await rows.row(entryId);
    if (row === undefined) return;
    const hiddenAt = clock.now();
    await userState.write(hiddenRecords.record(entryId).change(hiddenAt.toISOString()));
    await changeList([...list, { entryId, hiddenAt, row }].sort(newestFirst));
  }

  async function restore(entryId: string): Promise<void> {
    if (!has(entryId)) return;
    await userState.write(hiddenRecords.record(entryId).change(undefined));
    await changeList(list.filter((hiddenEntry) => hiddenEntry.entryId !== entryId));
  }

  // One change at a time, so each one starts from what the one before it left.
  let lastChange: Promise<unknown> = Promise.resolve();
  function inTurn<T>(change: () => Promise<T>): Promise<T> {
    const result = lastChange.then(change);
    lastChange = result.catch(() => undefined);
    return result;
  }

  return {
    get list() {
      return list;
    },
    has,
    hide: (entryId) => inTurn(() => hide(entryId)),
    restore: (entryId) => inTurn(() => restore(entryId)),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
