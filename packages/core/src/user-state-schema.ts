import { FontSizeSchema, ThemeSchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord, declareRecords } from './user-state-record';
import type { UserStateMigration } from './user-state';

/**
 * The user-state schema (ADR 0013): every record the Core keeps, and the
 * migrations that bring an older schema forward to it. Declare every record
 * here, so one place shows all a migration has to carry forward.
 */

/** The record that holds the schema version of the user state, a whole number. */
export const SCHEMA_VERSION_KEY = 'schema.version';

/** An instant, kept as an ISO 8601 date and time in UTC. */
const InstantSchema = z.iso.datetime();

/** A card's Entry and the local date it was on screen. */
const EntryOnDateSchema = z.object({ entryId: z.string(), date: z.string() });

/**
 * Every record of the user state. The Cycle and the Word of the Day keep the
 * `feed.` keys from 0.2, when the Feed held them.
 */
export const userStateRecords = {
  /** The user's Theme. */
  theme: declareRecord('settings.theme', ThemeSchema),
  /** The user's font size. */
  fontSize: declareRecord('settings.fontSize', FontSizeSchema),
  /** Whether the user has haptics on. */
  vibration: declareRecord('settings.vibration', z.boolean()),
  /** That the Feed's swipe hint was shown. */
  swipeHintShown: declareRecord('feed.swipeHintShown', z.literal(true)),
  /** The card the reader was on last, and the local date they were on it. */
  feedPosition: declareRecord('feed.position', EntryOnDateSchema),
  /** The current Cycle: its number and the seed of its shuffle. */
  cycle: declareRecord(
    'feed.cycle',
    z.object({ id: z.number().int().positive(), seed: z.number().int().nonnegative() }),
  ),
  /** The Entries Seen in the current Cycle, one record per Entry, by Entry id. */
  seen: declareRecords('feed.seen.', z.literal(true)),
  /** The Word of the Day and the local date it belongs to. */
  wordOfTheDay: declareRecord('feed.wordOfTheDay', EntryOnDateSchema),
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
  /** The Hidden Entries, one record per Entry, by Entry id: the instant it was hidden. */
  hiddenEntries: declareRecords('hidden.', InstantSchema),
};

/**
 * The user-state schema, one step per version. Append a step to change it;
 * never edit or remove one that has shipped. A step names its keys as they
 * were in its version, since the records above may change after it.
 */
export const userStateMigrations: readonly UserStateMigration[] = [
  // 0.2: the user settings (Theme, font size). A new store has nothing to bring forward.
  { version: 1, migrate: () => Promise.resolve(new Map()) },
  // After 0.2: the settings are kept as JSON like every other record, not as bare text.
  {
    version: 2,
    async migrate({ get }) {
      const changes = new Map<string, string>();
      for (const key of ['settings.theme', 'settings.fontSize']) {
        const text = await get(key);
        if (text !== undefined) changes.set(key, JSON.stringify(text));
      }
      return changes;
    },
  },
  // After 0.2: Seen is one record per Entry (`feed.seen.` + id), not one array, so
  // sync can merge it record by record (ADR 0013). An unreadable array is dropped,
  // as 0.2 read nothing Seen from it.
  {
    version: 3,
    async migrate({ get }) {
      const text = await get('feed.seen');
      if (text === undefined) return new Map();
      const changes = new Map<string, string | undefined>([['feed.seen', undefined]]);
      const ids = z.array(z.string()).safeParse(parseJson(text));
      for (const id of ids.data ?? []) changes.set(`feed.seen.${id}`, JSON.stringify(true));
      return changes;
    },
  },
];

/** The value the text holds as JSON, or nothing when it is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
