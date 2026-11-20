import { pluralCount, type EditionStrings, type SpotlightSnapshot } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import type { Collections } from '../saved/collections';
import type { Favorites } from '../saved/favorites';
import type { WordOfTheDayArchive } from '../saved/word-of-the-day-archive';
import { eligibleWidgetEntries } from '../widget/widget';

/** What the iPhone search finds of SLOVO, decided by the Core, so native code only writes it. */
export interface Spotlight {
  /**
   * The Spotlight Snapshot of the user state as it is now, for the app's
   * native module to replace the whole index with: each Entry in Favorites,
   * any Collection or the Word of the Day archive once, Favorites first, then
   * the Collections, then the archive, with the text the Widget Snapshot
   * gives it, and every Collection, newest first, empty ones too. Only
   * Eligible Entries are in it, as in the Widget Snapshot, so no Hidden or
   * Retired Entry. Empty while the Feature Switch `spotlight` is off, by its
   * effective value at the time of the call, so the index is emptied.
   */
  snapshot(
    strings: Pick<EditionStrings, 'notificationBody' | 'spotlight'>,
  ): Promise<SpotlightSnapshot>;
  /**
   * Calls `listener` after each change of Favorites, the Collections or the
   * Word of the Day archive, so the shell hands the native module a fresh
   * snapshot. Returns the call that stops it.
   */
  subscribe(listener: () => void): () => void;
}

/** The Spotlight over the composition's Entries, Favorites, Collections and Word of the Day archive. */
export function createSpotlight({
  edition,
  entries,
  favorites,
  collections,
  wordOfTheDayArchive,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'locale'>;
  entries: Entries;
  favorites: Favorites;
  collections: Collections;
  wordOfTheDayArchive: Pick<WordOfTheDayArchive, 'list' | 'subscribe'>;
}): Spotlight {
  const countOf = pluralCount(edition.locale);
  return {
    async snapshot(strings) {
      if (!edition.isFeatureEnabled('spotlight')) return { entries: [], collections: [] };
      const eligible = await eligibleWidgetEntries(entries, strings.notificationBody);
      const kept = new Set([
        ...favorites.list.map(({ entryId }) => entryId),
        ...collections.list.flatMap(({ id }) =>
          collections.entries(id).map(({ entryId }) => entryId),
        ),
        ...wordOfTheDayArchive.list.map(({ row }) => row.entryId),
      ]);
      const byId = new Map(eligible.map((entry) => [entry.id, entry]));
      return {
        entries: [...kept].flatMap((id) => {
          const entry = byId.get(id);
          return entry === undefined ? [] : [{ entry, route: `entry/${id}` }];
        }),
        collections: collections.list.map(({ id, name, count }) => ({
          id,
          name,
          secondLine: countOf(strings.spotlight.collection, count),
          route: `saved/collections/${id}`,
        })),
      };
    },
    subscribe(listener) {
      const stops = [
        favorites.subscribe(listener),
        collections.subscribe(listener),
        wordOfTheDayArchive.subscribe(listener),
      ];
      return () => {
        for (const stop of stops) stop();
      };
    },
  };
}
