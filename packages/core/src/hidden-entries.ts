import { openEntryList } from './entry-list';
import type { EntryRowModel, EntryRows } from './entry-row';
import { createInTurn } from './in-turn';
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
   * Hides the Entry, as of now, or as of `hiddenAt` when given: the undo of a
   * restore passes the time the Entry was hidden before, so it returns to its
   * old place in the list. A Hidden Entry keeps the time it was hidden, and an
   * id the Language Pack doesn't have is skipped.
   */
  hide(entryId: string, hiddenAt?: Date): Promise<void>;
  /**
   * Makes a Hidden Entry eligible again. It is also the undo of a hide.
   * Gives the time the Entry was hidden, for `hide` to take back as its undo,
   * or nothing when the Entry wasn't Hidden.
   */
  restore(entryId: string): Promise<Date | undefined>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/**
 * Opens the Hidden Entries over the user state, for the Core composition,
 * which reads eligibility again in `eligibilityChanged` after each change,
 * before the subscribers hear of it. The list follows the written change even
 * when reading eligibility again fails; the next change or the next app
 * session reads it again.
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
  const hiddenEntries = await openEntryList({
    records: userStateRecords.hiddenEntries,
    timeKey: 'hiddenAt',
    rows,
    userState,
    clock,
    afterWrite: eligibilityChanged,
  });
  const inTurn = createInTurn();

  return {
    get list() {
      return hiddenEntries.list;
    },
    has: hiddenEntries.has,
    hide: (entryId, hiddenAt) => inTurn(() => hiddenEntries.add(entryId, hiddenAt)),
    restore: (entryId) => inTurn(() => hiddenEntries.remove(entryId)),
    subscribe: hiddenEntries.subscribe,
  };
}
