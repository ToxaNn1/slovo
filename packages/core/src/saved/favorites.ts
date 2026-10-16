import { openEntryList } from '../entries/entry-list';
import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import { createInTurn } from '../in-turn';
import type { Clock } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** An Entry in Favorites. */
export interface Favorite {
  readonly entryId: string;
  /** When the user added it. */
  readonly addedAt: Date;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

/**
 * Favorites: the one built-in list of Entries the user marked with the heart.
 * It keeps any Entry the Language Pack has, Retired or not, and is read from
 * the user state once, when it opens, like the Cycle, so open one per app
 * session (the Core composition does). A change is made in memory only once
 * it is written.
 */
export interface Favorites {
  /**
   * The Entries in Favorites, newest first; its length is the count. An id
   * the Language Pack doesn't have is left out. A change never edits this
   * array: it makes a new one and tells the subscribers, so the array stays
   * the same until something changes.
   */
  readonly list: readonly Favorite[];
  /** Whether the Entry is in Favorites. */
  has(entryId: string): boolean;
  /**
   * Adds the Entry, as of now. An Entry already in Favorites keeps the time it
   * was added, and an id the Language Pack doesn't have is skipped.
   */
  add(entryId: string): Promise<void>;
  /** Takes the Entry out of Favorites. */
  remove(entryId: string): Promise<void>;
  /** Adds the Entry, or takes it out if it is in. Resolves to whether it is in Favorites now. */
  toggle(entryId: string): Promise<boolean>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Opens Favorites over the user state, for the Core composition. */
export async function openFavorites({
  rows,
  userState,
  clock,
}: {
  rows: EntryRows;
  userState: UserState;
  clock: Clock;
}): Promise<Favorites> {
  const favorites = await openEntryList({
    records: userStateRecords.favorites,
    timeKey: 'addedAt',
    rows,
    userState,
    clock,
  });
  const inTurn = createInTurn();

  return {
    get list() {
      return favorites.list;
    },
    has: favorites.has,
    add: (entryId) => inTurn(() => favorites.add(entryId)),
    remove: (entryId) =>
      inTurn(async () => {
        await favorites.remove(entryId);
      }),
    toggle: (entryId) =>
      inTurn(async () => {
        if (favorites.has(entryId)) await favorites.remove(entryId);
        else await favorites.add(entryId);
        return favorites.has(entryId);
      }),
    subscribe: favorites.subscribe,
  };
}
