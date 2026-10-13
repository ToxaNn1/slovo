import { openCycle } from './cycle';
import type { Edition } from './edition';
import { createEntries } from './entries';
import { createEntryRows, type EntryRowModel } from './entry-row';
import { openFavorites, type Favorites } from './favorites';
import { buildEntryCard, openFeed, type EntryFeedCard, type Feed } from './feed';
import type { Clock, ContentReadPort, Random } from './ports';
import type { UserState } from './user-state';
import { openWordOfTheDay } from './word-of-the-day';

/**
 * The Core features that open once the Language Pack is open, linked to each
 * other inside the composition, so a shell subscribes to what it draws and
 * holds no rule between them (ADR 0018). The settings open before the
 * Language Pack and stay apart.
 */
export interface Composition {
  /** The Feed of the app session. */
  readonly feed: Feed;
  /** Favorites, which a heart tapped anywhere changes. */
  readonly favorites: Favorites;
  /**
   * The Entry card of any Entry, Retired or not, for a screen that opens a
   * kept Entry; nothing for an id the Language Pack doesn't have. Opening it
   * never makes the Entry Seen: Seen comes from the Feed alone.
   */
  entryCard(entryId: string): Promise<EntryFeedCard | undefined>;
  /** The row model of any Entry, Retired or not, for a list; nothing for an id the Language Pack doesn't have. */
  entryRow(entryId: string): Promise<EntryRowModel | undefined>;
}

/**
 * Opens the composition for a new app session, once the Language Pack is
 * open: one Entries module, one Cycle and one Word of the Day over the stored
 * user state, shared by every feature it opens. The Cycle and the Word of the
 * Day keep their state in memory for the session (ADR 0013), so open one
 * composition per app session.
 */
export async function openComposition({
  content,
  edition,
  userState,
  clock,
  random,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  random: Random;
}): Promise<Composition> {
  const entries = createEntries({ content, edition });
  const rows = createEntryRows(entries);
  const cycle = await openCycle({ entries, userState, random });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  const [feed, favorites] = await Promise.all([
    openFeed({ entries, userState, clock, cycle, wordOfTheDay }),
    openFavorites({ rows, userState, clock }),
  ]);
  return {
    feed,
    favorites,
    async entryCard(entryId) {
      const entry = await entries.get(entryId);
      return entry === undefined ? undefined : buildEntryCard(entries, entry);
    },
    entryRow: (entryId) => rows.row(entryId),
  };
}
