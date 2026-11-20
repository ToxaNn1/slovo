import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import { createInTurn, createSubscribers, newestFirst } from '../in-turn';
import { dateKeyOf, localDateAfter, localDayOf, todayDate } from '../local-date';
import type { Clock } from '../ports';
import { staged, writeStaged, type AnyStagedPiece } from '../user-state/staged-write';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

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

/** How many local days before today a clear still counts the Entries Seen on: the Weekly Recap's reach. */
const CLEARED_DAYS = 7;

/** The Entries Seen on a local date that a clear took out of History. */
export interface ClearedSeen {
  readonly entries: number;
  /** How many of them are Words. */
  readonly words: number;
}

const nothingCleared: ClearedSeen = { entries: 0, words: 0 };

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
  /**
   * Deletes every History record at once. The same write keeps how many
   * Entries of the list were Seen on each local date of the last week, so
   * today's Words Seen and the Weekly Recap lose nothing; nothing else changes.
   */
  clear(): Promise<void>;
  /**
   * The Entries Seen on the local date (its date key) that a clear took out
   * of History; they are no longer in `list`. Kept for the last week.
   */
  cleared(date: string): ClearedSeen;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** How an Entry that becomes Seen joins History; the shell never gets it. */
export interface HistoryRecorder {
  /**
   * Writes the Entry's History entry in one write with `pieces` (the Feed's
   * Seen mark and the rest of its write), History's piece first, in History's
   * turn, so a clear never runs between staging and committing it: the Entry
   * with the time it was Seen, which puts it on top unless the clock went
   * back, evicting the oldest beyond `HISTORY_CAP`.
   */
  record(seen: Seen, pieces: readonly (AnyStagedPiece | undefined)[]): Promise<void>;
}

/** An Entry the Feed marked Seen: a History entry without its row. */
export type Seen = Omit<HistoryEntry, 'row'>;

const { history: historyRecords, historyCleared: clearedRecords } = userStateRecords;

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
  clock,
}: {
  rows: EntryRows;
  userState: UserState;
  clock: Clock;
}): Promise<{ history: History; recorder: HistoryRecorder }> {
  const stored = await userState.list(historyRecords);
  let cleared: ReadonlyMap<string, ClearedSeen> = await userState.list(clearedRecords);
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

  /** The kept entries with the Entry in its place, the oldest beyond `HISTORY_CAP` last. */
  function withEntry(entry: Kept): Kept[] {
    const others = kept.filter(({ entryId }) => entryId !== entry.entryId);
    // In its place by Seen time, as reopening and the Sync's trim order it,
    // also when the clock went back or a synced entry is ahead of it.
    const found = others.findIndex(({ seenAt }) => seenAt.getTime() <= entry.seenAt.getTime());
    const at = found === -1 ? others.length : found;
    return [...others.slice(0, at), entry, ...others.slice(at)];
  }

  async function record(
    { entryId, seenAt, wordOfTheDay }: Seen,
    pieces: readonly (AnyStagedPiece | undefined)[],
  ): Promise<void> {
    const all = withEntry({ entryId, seenAt, wordOfTheDay, row: await rows.row(entryId) });
    const evicted = all.slice(HISTORY_CAP);
    const joined = staged(
      new Map([
        ...historyRecords.record(entryId).change({ seenAt: seenAt.toISOString(), wordOfTheDay }),
        ...evicted.flatMap((old) => [...historyRecords.record(old.entryId).change(undefined)]),
      ]),
      // The list the evictions were written from: nothing changes it within the turn.
      () => {
        changeKept(all.slice(0, HISTORY_CAP));
      },
    );
    await writeStaged(userState, [joined, ...pieces]);
  }

  async function clear(): Promise<void> {
    // Every History record, also any this app session never read.
    const ids = new Set([
      ...(await userState.list(historyRecords)).keys(),
      ...kept.map((entry) => entry.entryId),
    ]);
    if (ids.size === 0) return;
    const counted = clearedWith(list);
    await userState.write(
      new Map([
        ...[...ids].flatMap((id) => [...historyRecords.record(id).change(undefined)]),
        ...[...cleared.keys()].flatMap((date) =>
          counted.has(date) ? [] : [...clearedRecords.record(date).change(undefined)],
        ),
        ...[...counted].flatMap(([date, count]) => [...clearedRecords.record(date).change(count)]),
      ]),
    );
    cleared = counted;
    changeKept([]);
  }

  /**
   * What the clears took out once `entries` leave too, by local date in the
   * clock's time zone: the dates of the last `CLEARED_DAYS` days, so an older
   * date's count is dropped.
   */
  function clearedWith(entries: readonly HistoryEntry[]): Map<string, ClearedSeen> {
    const oldest = dateKeyOf(localDateAfter(todayDate(clock), -CLEARED_DAYS));
    const counted = new Map([...cleared].filter(([date]) => date >= oldest));
    for (const { seenAt, row } of entries) {
      const date = dateKeyOf(localDayOf(seenAt, clock).date);
      if (date < oldest) continue;
      const { entries: before, words } = counted.get(date) ?? nothingCleared;
      counted.set(date, { entries: before + 1, words: words + (row.kind === 'word' ? 1 : 0) });
    }
    return counted;
  }

  return {
    history: {
      get list() {
        return list;
      },
      clear: () => inTurn(clear),
      cleared: (date) => cleared.get(date) ?? nothingCleared,
      subscribe: subscribers.subscribe,
    },
    recorder: {
      record: (seen, pieces) => inTurn(() => record(seen, pieces)),
    },
  };
}
