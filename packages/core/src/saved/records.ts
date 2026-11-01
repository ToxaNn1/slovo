import { z } from 'zod';

import { declareRecords, InstantSchema } from '../user-state/user-state-record';

/** The records of Favorites, Collections, History and the Word of the Day archive. */
export const savedRecords = {
  /**
   * The Word of the Day archive, one record per local date `YYYY-MM-DD`, by
   * that date: the id of the Word of the Day whose card the reader Seen on it,
   * written in the same write as the Seen mark (ADR 0054). It syncs last write
   * wins (ADR 0041); a new key, so no migration.
   */
  wordOfTheDayArchive: declareRecords('wordOfTheDayArchive.', z.string().min(1)),
  /** The Entries in Favorites, one record per Entry, by Entry id: the instant it was added. */
  favorites: declareRecords('favorites.', InstantSchema),
  /** The Collections, one record per Collection, by Collection id: its name and the instant it was created. */
  collections: declareRecords(
    'collections.',
    z.object({ name: z.string(), createdAt: InstantSchema }),
  ),
  /**
   * The Entries in Collections, one record per Entry in a Collection, by
   * Collection id, a `.` and the Entry id (neither holds a `.`): the instant
   * it was added.
   */
  collectionEntries: declareRecords('collectionEntries.', InstantSchema),
  /**
   * The Entries in History, one record per Entry, by Entry id: the instant
   * the Feed last marked it Seen, and whether it was the Word of the Day's card.
   */
  history: declareRecords(
    'history.',
    z.object({ seenAt: InstantSchema, wordOfTheDay: z.boolean() }),
  ),
};
