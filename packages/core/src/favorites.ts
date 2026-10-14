import type { EntryRowModel, EntryRows } from './entry-row';
import { createInTurn, createSubscribers, newestFirst } from './in-turn';
import type { Clock } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

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

const { favorites: favoriteRecords } = userStateRecords;

const newestFavorite = newestFirst<Favorite>(
  (favorite) => favorite.addedAt,
  (favorite) => favorite.entryId,
);

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
  const stored = await userState.list(favoriteRecords);
  const kept = await Promise.all(
    [...stored].map(async ([entryId, added]): Promise<Favorite | undefined> => {
      const row = await rows.row(entryId);
      return row === undefined ? undefined : { entryId, addedAt: new Date(added), row };
    }),
  );
  let list: readonly Favorite[] = kept
    .filter((favorite): favorite is Favorite => favorite !== undefined)
    .sort(newestFavorite);
  const subscribers = createSubscribers();

  function changeList(changed: readonly Favorite[]): void {
    list = changed;
    subscribers.tell();
  }

  const has = (entryId: string) => list.some((favorite) => favorite.entryId === entryId);

  async function add(entryId: string): Promise<void> {
    if (has(entryId)) return;
    const row = await rows.row(entryId);
    if (row === undefined) return;
    const addedAt = clock.now();
    await userState.write(favoriteRecords.record(entryId).change(addedAt.toISOString()));
    changeList([...list, { entryId, addedAt, row }].sort(newestFavorite));
  }

  async function remove(entryId: string): Promise<void> {
    if (!has(entryId)) return;
    await userState.write(favoriteRecords.record(entryId).change(undefined));
    changeList(list.filter((favorite) => favorite.entryId !== entryId));
  }

  const inTurn = createInTurn();

  return {
    get list() {
      return list;
    },
    has,
    add: (entryId) => inTurn(() => add(entryId)),
    remove: (entryId) => inTurn(() => remove(entryId)),
    toggle: (entryId) =>
      inTurn(async () => {
        if (has(entryId)) await remove(entryId);
        else await add(entryId);
        return has(entryId);
      }),
    subscribe: subscribers.subscribe,
  };
}
