import { FontSizeSchema, NotificationTimesSchema, ThemeSchema } from '@slovo/contracts';
import { z } from 'zod';

import {
  declareRecord,
  declareRecords,
  parseJson,
  type SyncMark,
  type UserStateRecord,
  type UserStateRecords,
} from './user-state-record';
import type { UserStateMigration } from './user-state-migration';

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
  /** The schema version, written by `openUserState` with each migration; it never syncs. */
  schemaVersion: declareRecord(SCHEMA_VERSION_KEY, z.number().int().nonnegative(), {
    sync: 'device-only',
  }),
  /** The user's Theme. */
  theme: declareRecord('settings.theme', ThemeSchema),
  /** The user's font size. */
  fontSize: declareRecord('settings.fontSize', FontSizeSchema),
  /** Whether the user has haptics on. It stays on the device, which may have no haptics. */
  vibration: declareRecord('settings.vibration', z.boolean(), { sync: 'device-only' }),
  /** That the Feed's swipe hint was shown on this device. */
  swipeHintShown: declareRecord('feed.swipeHintShown', z.literal(true), { sync: 'device-only' }),
  /** The card the reader was on last on this device, and the local date they were on it. */
  feedPosition: declareRecord('feed.position', EntryOnDateSchema, { sync: 'device-only' }),
  /** The current Cycle: its number and the seed of its shuffle. */
  cycle: declareRecord(
    'feed.cycle',
    z.object({ id: z.number().int().positive(), seed: z.number().int().nonnegative() }),
  ),
  /**
   * The Entries Seen, one record per Entry, by Entry id: the id of the Cycle
   * it was Seen in. Only the current Cycle's count, so a mark another device
   * kept in an older Cycle never carries into this one.
   */
  seen: declareRecords('feed.seen.', z.number().int().positive()),
  /**
   * The Word of the Day and the local date it belongs to. It stays on the
   * device: it is the Word of the morning notification this device's own plan
   * Reserves (ADR 0021, 0022).
   */
  wordOfTheDay: declareRecord('feed.wordOfTheDay', EntryOnDateSchema, { sync: 'device-only' }),
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
  /**
   * The Categories the user put in the Mix or took out of it, one record per
   * Category, by Category id (which holds no `.`): whether it is in. A
   * Category without one follows the Edition's default Mix (ADR 0019).
   */
  mixCategories: declareRecords('mix.categories.', z.boolean()),
  /** Whether the user has Corrections, as a whole, in the Mix; without it, the Edition's default Mix. */
  mixCorrections: declareRecord('mix.corrections', z.boolean()),
  /**
   * The Active Days, one record per day, by local date `YYYY-MM-DD`: that the
   * app was opened that day. They sync as a union (0.8).
   */
  activeDays: declareRecords('activeDays.', z.literal(true), { sync: 'union' }),
  /**
   * The user's notification times, local times `HH:MM`. Without the record,
   * the Edition's default times; an empty list is a record of its own, so no
   * times never falls back to the defaults.
   */
  notificationTimes: declareRecord('notifications.times', NotificationTimesSchema, {
    sync: 'device-only',
  }),
  /** Whether notifications play their sound; without the record, they do. */
  notificationSound: declareRecord('notifications.sound', z.boolean(), { sync: 'device-only' }),
  /**
   * The planned notifications, one record per notification, by its local date
   * and local time joined with a `T` (`2026-10-14T09:00`): the id of its Word.
   * A Word with such a record is Reserved; Reserved is never stored on its own.
   */
  notificationPlan: declareRecords('notifications.plan.', z.string().min(1), {
    sync: 'device-only',
  }),
  /**
   * That the onboarding was finished or skipped, and the instant it was;
   * without the record, it opens. It stays on the device: the onboarding asks
   * this device for permission to notify.
   */
  onboardingFinished: declareRecord('onboarding.finished', InstantSchema, { sync: 'device-only' }),
  /**
   * The instant the last check for a content update started; without the
   * record, none has, so one is due. It stays on the device, like the pack it
   * downloads.
   */
  contentUpdateCheckedAt: declareRecord('contentUpdate.checkedAt', InstantSchema, {
    sync: 'device-only',
  }),
  /**
   * The last answer of the backend's remote Feature Switches: the features
   * the owner turned off remotely, by name, and the ETag that names them
   * (ADR 0040). Without the record, none is known, and the Edition's own
   * values hold. It stays on the device: each device asks for itself.
   */
  remoteSwitches: declareRecord(
    'edition.switches',
    z.object({ off: z.array(z.string()), etag: z.string() }),
    { sync: 'device-only' },
  ),
  /**
   * The best Game result: the most Rounds passed in one finished Game, from 0
   * to the 15 Rounds of a Game; without the record, no Game has finished yet.
   * Sync keeps the higher of two devices' results (0.8).
   */
  gameBest: declareRecord('game.best', z.number().int().min(0).max(15), { sync: 'highest' }),
  /**
   * The changes of synced records not yet sent to the Account, one record per
   * changed record, by its key: the instant it changed and its new text, or
   * `null` for a deletion (a tombstone). The tracked user state writes one with
   * each write of a synced record (0.8); it never syncs itself.
   */
  syncPending: declareRecords(
    'sync.pending.',
    z.object({ changedAt: InstantSchema, value: z.string().nullable() }),
    { sync: 'device-only' },
  ),
  /** The Sync cursor: the server's sequence number of the last record pulled; without it, no sync has pulled yet. */
  syncCursor: declareRecord('sync.cursor', z.number().int().nonnegative(), {
    sync: 'device-only',
  }),
};

/** Every declared record and kind of record, for finding the one a key belongs to. */
const declared: readonly (UserStateRecord<unknown> | UserStateRecords<unknown>)[] =
  Object.values(userStateRecords);

/**
 * How the record under the key syncs, by the schema: its mark,
 * `last-write-wins` for an unmarked record, and nothing for a key the schema
 * doesn't declare, such as a record of a newer app.
 */
export function syncMarkOf(key: string): SyncMark | 'last-write-wins' | undefined {
  const declaration = declared.find((record) =>
    'key' in record
      ? record.key === key
      : key.startsWith(record.prefix) && key.length > record.prefix.length,
  );
  if (declaration === undefined) return undefined;
  return declaration.sync ?? 'last-write-wins';
}

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
  // 0.8: a Seen record holds the id of the Cycle it was Seen in, not `true`, so a
  // device offline since an older Cycle can't carry its marks into a new one. Each
  // takes the current Cycle, or the first, which opens when none reads. The last
  // migration that may re-encode a record that syncs (ADR 0013): from 0.8 a new
  // encoding takes a new key.
  {
    version: 4,
    async migrate({ get, list }) {
      const text = await get('feed.cycle');
      // The Cycle as 0.7 kept it; one that doesn't read opens as the first.
      const cycle = z
        .object({ id: z.number().int().positive(), seed: z.number().int().nonnegative() })
        .safeParse(text === undefined ? undefined : parseJson(text));
      const changes = new Map<string, string>();
      for (const [key, value] of await list('feed.seen.')) {
        if (parseJson(value) === true) changes.set(key, JSON.stringify(cycle.data?.id ?? 1));
      }
      return changes;
    },
  },
];
