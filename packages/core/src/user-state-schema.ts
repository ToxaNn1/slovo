import { FontSizeSchema, ThemeSchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord } from './user-state-record';
import type { UserStateMigration } from './user-state';

/**
 * The user-state schema (ADR 0013): every record the Core keeps, and the
 * migrations that bring an older schema forward to it. Declare every record
 * here, so one place shows all a migration has to carry forward.
 */

/** The record that holds the schema version of the user state, a whole number. */
export const SCHEMA_VERSION_KEY = 'schema.version';

/** A card's Entry and the local date it was on screen. */
const EntryOnDateSchema = z.object({ entryId: z.string(), date: z.string() });

/**
 * Every record of the user state. The Cycle and the Word of the Day keep the
 * `feed.` keys from 0.2, when the Feed held them, so no migration is needed.
 */
export const userStateRecords = {
  /** The user's Theme. */
  theme: declareRecord('settings.theme', ThemeSchema),
  /** The user's font size. */
  fontSize: declareRecord('settings.fontSize', FontSizeSchema),
  /** That the Feed's swipe hint was shown. */
  swipeHintShown: declareRecord('feed.swipeHintShown', z.literal(true)),
  /** The card the reader was on last, and the local date they were on it. */
  feedPosition: declareRecord('feed.position', EntryOnDateSchema),
  /** The current Cycle: its number and the seed of its shuffle. */
  cycle: declareRecord(
    'feed.cycle',
    z.object({ id: z.number().int().positive(), seed: z.number().int().nonnegative() }),
  ),
  /** The ids of the Entries Seen in the current Cycle. */
  seen: declareRecord('feed.seen', z.array(z.string())),
  /** The Word of the Day and the local date it belongs to. */
  wordOfTheDay: declareRecord('feed.wordOfTheDay', EntryOnDateSchema),
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
];
