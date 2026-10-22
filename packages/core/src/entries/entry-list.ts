import type { EntryRowModel, EntryRows } from './entry-row';
import { createSubscribers, newestFirst } from '../in-turn';
import type { Clock } from '../ports';
import type { UserState } from '../user-state/user-state';
import type { UserStateRecords } from '../user-state/user-state-record';

/**
 * What Favorites and the Hidden Entries share: a list of Entries the user
 * keeps, one user-state record per Entry holding the instant it went in.
 * Internal: `index.ts` does not export it.
 */

/** An Entry in the list: its id, the time it went in under the list's own name, and its row. */
export type ListedEntry<TimeKey extends string> = {
  readonly entryId: string;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
} & Readonly<Record<TimeKey, Date>>;

/**
 * A list of Entries the user keeps, read from the user state once, when it
 * opens. A change is made in memory only once it is written. Its changes are
 * not queued: the caller runs them one at a time, in its own queue, so it can
 * put its own steps in the same turn.
 */
export interface EntryList<TimeKey extends string> {
  /**
   * The Entries, newest first, those that went in at the same instant in a
   * stable order. An id the Language Pack doesn't have is left out. A change
   * never edits this array: it makes a new one and tells the subscribers, so
   * the array stays the same until something changes.
   */
  readonly list: readonly ListedEntry<TimeKey>[];
  /** Whether the Entry is in the list. */
  readonly has: (entryId: string) => boolean;
  /**
   * Adds the Entry, as of now, or as of `at` when given. An Entry already in
   * keeps its time, and an id the Language Pack doesn't have is skipped.
   */
  add(entryId: string, at?: Date): Promise<void>;
  /** Takes the Entry out. Gives the time it went in, or nothing when it wasn't in. */
  remove(entryId: string): Promise<Date | undefined>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * Opens the list over its records. `afterWrite`, when given, runs after each
 * change is written and before the list changes in memory and its subscribers
 * hear of it, so a subscriber finds what it changed done. The list follows
 * the written change even when `afterWrite` fails.
 */
export async function openEntryList<TimeKey extends string>({
  records,
  timeKey,
  rows,
  userState,
  clock,
  afterWrite,
}: {
  records: UserStateRecords<string>;
  /** The name of an Entry's time in the list. */
  timeKey: TimeKey;
  rows: EntryRows;
  userState: UserState;
  clock: Clock;
  afterWrite?: () => Promise<void>;
}): Promise<EntryList<TimeKey>> {
  const listed = (entryId: string, at: Date, row: EntryRowModel) =>
    // A computed key widens to a string index; `timeKey` is the one it holds.
    ({ entryId, row, [timeKey]: at }) as ListedEntry<TimeKey>;
  const timeOf = (entry: ListedEntry<TimeKey>): Date => entry[timeKey];
  const newest = newestFirst(timeOf, (entry) => entry.entryId);

  const stored = await userState.list(records);
  const rowOf = await rows.rows(stored.keys());
  let list: readonly ListedEntry<TimeKey>[] = [...stored]
    .flatMap(([entryId, at]) => {
      const row = rowOf.get(entryId);
      return row === undefined ? [] : [listed(entryId, new Date(at), row)];
    })
    .sort(newest);
  const subscribers = createSubscribers();

  async function changeList(changed: readonly ListedEntry<TimeKey>[]): Promise<void> {
    try {
      await afterWrite?.();
    } finally {
      list = changed;
      subscribers.tell();
    }
  }

  const has = (entryId: string) => list.some((entry) => entry.entryId === entryId);

  return {
    get list() {
      return list;
    },
    has,
    async add(entryId, at = clock.now()) {
      if (has(entryId)) return;
      const row = await rows.row(entryId);
      if (row === undefined) return;
      await userState.write(records.record(entryId).change(at.toISOString()));
      await changeList([...list, listed(entryId, at, row)].sort(newest));
    },
    async remove(entryId) {
      const removed = list.find((entry) => entry.entryId === entryId);
      if (removed === undefined) return undefined;
      await userState.write(records.record(entryId).change(undefined));
      await changeList(list.filter((entry) => entry !== removed));
      return timeOf(removed);
    },
    subscribe: subscribers.subscribe,
  };
}
