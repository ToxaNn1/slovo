import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { searchKey } from './search-key';

/** The most queries Search remembers (ADR 0054). */
const RECENT_LIMIT = 10;

/**
 * The recent queries of Search (ADR 0054): the last 10 queries a result was
 * opened from, newest first, kept on the device only.
 */
export interface RecentQueries {
  /** The queries, newest first. */
  list(): Promise<readonly string[]>;
  /**
   * Saves the query a result was opened from, as typed without the spaces at
   * its ends, at the top. One that Search reads alike moves up in its place;
   * the oldest beyond 10 is dropped.
   */
  resultOpened(query: string): Promise<void>;
  /** Empties the queries («Очистити»). */
  clear(): Promise<void>;
}

const { recentQueries } = userStateRecords;

/** Opens the recent queries of Search in the user state. */
export function createRecentQueries({
  edition,
  userState,
}: {
  edition: Pick<Edition, 'searchLetters'>;
  userState: Pick<UserState, 'read' | 'write'>;
}): RecentQueries {
  const keyOf = (text: string) => searchKey(text, edition.searchLetters);
  const list = async () => (await userState.read(recentQueries)) ?? [];

  return {
    list,
    async resultOpened(query) {
      const saved = query.trim();
      const key = keyOf(saved);
      if (key === '') return;
      const others = (await list()).filter((kept) => keyOf(kept) !== key);
      await userState.write(recentQueries.change([saved, ...others].slice(0, RECENT_LIMIT)));
    },
    async clear() {
      await userState.write(recentQueries.change(undefined));
    },
  };
}
