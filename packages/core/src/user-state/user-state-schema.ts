import {
  DailyGoalSchema,
  FontSizeSchema,
  MistakeReportSchema,
  MixKindWeightSchema,
  QuickQuestionEverySchema,
  NotificationTimesSchema,
  RaritySchema,
  ThemeSchema,
} from '@slovo/contracts';
import { z } from 'zod';

import {
  declareRecord,
  declareRecords,
  parseJson,
  type SyncMark,
  type UserStateRecord,
  type UserStateRecords,
} from './user-state-record';
import { FEED_NOTICES } from '../feed-notice';
import type { UserStateMigration } from './user-state-migration';

/**
 * The user-state schema (ADR 0013): every record the Core keeps, and the
 * migrations that bring an older schema forward to it. Declare every record
 * here, so one place shows all a migration has to carry forward.
 */

/** The record that holds the schema version of the user state, a whole number. */
export const SCHEMA_VERSION_KEY = 'schema.version';

/** The record that marks the user state as kept by this install of the app. */
const INSTALLED_KEY = 'app.installed';

/** How many unsent Mistake Reports the device keeps at most (ADR 0056). */
export const MISTAKE_REPORT_QUEUE_SIZE = 20;

/** An instant, kept as an ISO 8601 date and time in UTC. */
const InstantSchema = z.iso.datetime();

/** A change of one Community Counter: one taken away, none or one added. */
const CounterChangeSchema = z.literal([-1, 0, 1]);

/** A card's Entry and the local date it was on screen. */
const EntryOnDateSchema = z.object({ entryId: z.string(), date: z.string() });

/** The learning actions XP comes from (ADR 0066). */
export const XpSourceSchema = z.literal([
  'game-round',
  'game-finished',
  'game-best',
  'daily-crossword',
  'review-answer',
  'quick-question',
]);

/**
 * One record of the XP log (ADR 0066): its local date and instant, and what
 * it records: XP a learning action earned on its date, a Streak freeze
 * consumed for its date, a missed day it covers, a Break started on its
 * date, with its length in days, or the Daily Goal the reader set from that
 * day on. The kinds the ADR names besides these come with their own tickets.
 */
const XpRecordSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('xp'),
    date: z.string(),
    at: InstantSchema,
    source: XpSourceSchema,
    amount: z.number().int().positive(),
  }),
  z.object({ kind: z.literal('freeze'), date: z.string(), at: InstantSchema }),
  z.object({
    kind: z.literal('break'),
    date: z.string(),
    at: InstantSchema,
    days: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('daily-goal'),
    date: z.string(),
    at: InstantSchema,
    goal: DailyGoalSchema,
  }),
]);

export type XpRecord = z.infer<typeof XpRecordSchema>;
export type XpSource = z.infer<typeof XpSourceSchema>;

/**
 * Every record of the user state. The Cycle and the Word of the Day keep the
 * `feed.` keys from 0.2, when the Feed held them.
 */
export const userStateRecords = {
  /** The schema version, written by `openUserState` with each migration; it never syncs. */
  schemaVersion: declareRecord(SCHEMA_VERSION_KEY, z.number().int().nonnegative(), {
    sync: 'device-only',
  }),
  /**
   * That this install of the app has opened its Account. Deleting the app
   * deletes the user state but, on iOS, not the Session in the Keychain, so
   * an Account that opens without the marker forgets a Session it finds
   * (#660). It stays on the device.
   */
  installed: declareRecord(INSTALLED_KEY, z.literal(true), { sync: 'device-only' }),
  /** The user's Theme. */
  theme: declareRecord('settings.theme', ThemeSchema),
  /** The user's font size. */
  fontSize: declareRecord('settings.fontSize', FontSizeSchema),
  /** Whether the user has haptics on. It stays on the device, which may have no haptics. */
  vibration: declareRecord('settings.vibration', z.boolean(), { sync: 'device-only' }),
  /**
   * Whether the reader hides the counters: «Без лічильників», which replaced
   * «Приховати Серію» in 1.0 and keeps its key, so a hidden Streak stays hidden
   * (ADR 0066). It syncs last write wins like the Theme (ADR 0041); without it
   * the counters show.
   */
  noCounters: declareRecord('settings.hideStreak', z.boolean()),
  /**
   * Whether the user has Self-check on. It syncs last write wins like the
   * Theme (ADR 0041); a new key needs no migration, since without it Self-check is off.
   */
  selfCheck: declareRecord('settings.selfCheck', z.boolean()),
  /**
   * Whether the user has «Сезонний декор» on (ADR 0055). It syncs last write
   * wins like the Theme (ADR 0041); a new key needs no migration, since
   * without it Seasonal Decor is on.
   */
  seasonalDecor: declareRecord('settings.seasonalDecor', z.boolean()),
  /**
   * Whether the user has «Ділитися анонімною статистикою» on: this device
   * counts and sends its Community Counters (ADR 0060). It stays on the
   * device, since syncing it would tie the counters to an Account; a new key
   * needs no migration, since without it sharing is on.
   */
  shareCounters: declareRecord('settings.shareCounters', z.boolean(), { sync: 'device-only' }),
  /**
   * The Daily Limit of 0.9 (ADR 0054), retired in 1.0 for the Daily Goal
   * (ADR 0066): no longer read, and kept declared so it still syncs last
   * write wins between devices on an older app.
   */
  dailyLimit: declareRecord(
    'settings.dailyLimit',
    z.union([z.literal('off'), z.literal(10), z.literal(20), z.literal(30)]),
  ),
  /** That the Feed's swipe hint was shown on this device. */
  swipeHintShown: declareRecord('feed.swipeHintShown', z.literal(true), { sync: 'device-only' }),
  /**
   * The Feed Notices the reader swiped past on this device and the local
   * date they are closed for; on another date none is closed (ADR 0054).
   */
  feedNoticesClosed: declareRecord(
    'feed.noticesClosed',
    z.object({ date: z.string(), notices: z.array(z.enum(FEED_NOTICES)) }),
    { sync: 'device-only' },
  ),
  /**
   * The Community Word the backend answered on the local date `date`, kept so
   * the week is read once a day; `null`, none (ADR 0060). It stays on the
   * device; a new key needs no migration.
   */
  communityWord: declareRecord(
    'feed.communityWord',
    z.object({
      date: z.string(),
      communityWord: z.object({ entryId: z.string(), adds: z.number() }).nullable(),
    }),
    { sync: 'device-only' },
  ),
  /**
   * The last 10 Search queries a result was opened from, newest first, no two
   * alike as Search reads them (ADR 0054). It stays on the device; a new key
   * needs no migration.
   */
  recentQueries: declareRecord('search.recentQueries', z.array(z.string()).max(10), {
    sync: 'device-only',
  }),
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
  /** The Hidden Entries, one record per Entry, by Entry id: the instant it was hidden. */
  hiddenEntries: declareRecords('hidden.', InstantSchema),
  /**
   * The Knowledge Marks, one record per Entry, by Entry id: the mark, the
   * Review step, the next Review local day, whether the Entry is Learned and,
   * from 0.8.13, the instant the mark was set (ADR 0043, 0054). Removing a mark
   * deletes the record. The mark time is optional, so a record kept before it
   * still reads and needs no migration.
   */
  knowledge: declareRecords(
    'knowledge.',
    z.object({
      mark: z.enum(['known', 'unknown']),
      step: z.literal([1, 3, 7, 30, 90]).nullable(),
      reviewDay: z.iso.date().nullable(),
      learned: z.boolean(),
      markedAt: InstantSchema.exactOptional(),
    }),
  ),
  /**
   * The confirmed Entries, one record per Entry, by Entry id: the instant the
   * Entry was confirmed, Known on a Review of 7 days or later or answered
   * right in a Game or a Quick Question (ADR 0043). A record is never
   * removed: a confirmed Entry stays confirmed whatever its mark does.
   */
  confirmed: declareRecords('confirmed.', InstantSchema),
  /**
   * The Categories the user put in the Mix or took out of it, one record per
   * Category, by Category id (which holds no `.`): whether it is in. A
   * Category without one follows the Edition's default Mix (ADR 0019).
   */
  mixCategories: declareRecords('mix.categories.', z.boolean()),
  /**
   * The Categories of Corrections the user put in the Mix or took out of it,
   * one record per Category, by Category id, apart from the Words' Categories,
   * whose ids they may share (ADR 0033): whether it is in. One without a
   * record follows the Edition's default Mix. It syncs last write wins like the
   * rest of the Mix (ADR 0041); a new key needs no migration.
   */
  mixCorrectionCategories: declareRecords('mix.correctionCategories.', z.boolean()),
  /** Whether the user has Corrections, as a whole, in the Mix; without it, the Edition's default Mix. */
  mixCorrections: declareRecord('mix.corrections', z.boolean()),
  /**
   * Whether the user has Idioms, as a whole, in the Mix; without it, the
   * Edition's default Mix. It syncs last write wins like the rest of the Mix
   * (ADR 0041); a new key needs no migration.
   */
  mixIdioms: declareRecord('mix.idioms', z.boolean()),
  /**
   * Whether the user has Synonym Rows, as a whole, in the Mix; without it, the
   * Edition's default Mix. It syncs last write wins like the rest of the Mix
   * (ADR 0041, 0051).
   */
  mixSynonymRows: declareRecord('mix.synonymRows', z.boolean()),
  /**
   * Whether the user has Tips, as a whole, in the Mix; without it, the
   * Edition's default Mix. It syncs last write wins like the rest of the Mix
   * (ADR 0041, 0051).
   */
  mixTips: declareRecord('mix.tips', z.boolean()),
  /**
   * The Rarity Floor the user chose, 1 to 5; without it, the Edition's
   * default. It syncs last write wins like the rest of the Mix (ADR 0041).
   */
  /**
   * The Mix kind weight the user chose for Corrections, Idioms, Synonym Rows
   * or Tips, one record per kind; without it, «Звичайно». It syncs last write
   * wins like the rest of the Mix (ADR 0041); a new key needs no migration.
   */
  mixKindWeights: declareRecords('mix.kindWeights.', MixKindWeightSchema),
  mixRarityFloor: declareRecord('mix.rarityFloor', RaritySchema),
  /**
   * The Rarity Ceiling the user chose, 1 to 5; without it, the Edition's
   * default. Never below the Rarity Floor when read. It syncs last write wins
   * like the rest of the Mix (ADR 0041).
   */
  mixRarityCeiling: declareRecord('mix.rarityCeiling', RaritySchema),
  /** How often the Feed asks a Quick Question; the Core's default unless the user chose. */
  mixQuickQuestion: declareRecord('mix.quickQuestion', QuickQuestionEverySchema),
  /**
   * The Active Days, one record per day, by local date `YYYY-MM-DD`: that the
   * app was opened that day. They sync as a union (0.8).
   */
  activeDays: declareRecords('activeDays.', z.literal(true), { sync: 'union' }),
  /**
   * The XP log, one record per entry, by a unique id: XP for a learning
   * action with its source, or a Daily Goal set, on a local date `YYYY-MM-DD` at an instant. It is
   * append-only and syncs as a union by id, so a total derived from it is the
   * same on every device and never doubles (ADR 0066).
   */
  xpLog: declareRecords('xp.', XpRecordSchema, { sync: 'union' }),
  /**
   * The last day of the Streak a missed day broke, once the Analytics event of
   * that break is emitted, so a later app run emits it no more. Without it, no
   * break is reported yet. It stays on the device, like the events.
   */
  streakBrokenReported: declareRecord('progress.streakBrokenReported', z.string(), {
    sync: 'device-only',
  }),
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
   * The title templates of the notifications (ADR 0054), by their index in
   * the Edition's list: `last`, the template of the last notification that
   * came, and `planned`, each planned notification's, by the id of its plan
   * record. The plan reads them so no template comes twice in a row.
   */
  notificationTitles: declareRecord(
    'notifications.titles',
    z.strictObject({
      last: z.number().int().nonnegative().optional(),
      planned: z.record(z.string(), z.number().int().nonnegative()),
    }),
    { sync: 'device-only' },
  ),
  /**
   * That the onboarding was finished or skipped, and the instant it was;
   * without the record, it opens. It stays on the device: the onboarding asks
   * this device for permission to notify.
   */
  onboardingFinished: declareRecord('onboarding.finished', InstantSchema, { sync: 'device-only' }),
  /**
   * The local date `YYYY-MM-DD` a reader finished or skipped the onboarding
   * with 0.8.13 or later, from which their first week counts its Active Days;
   * without the record, as for a reader who finished it before, there is no
   * first week. It stays on the device, like the onboarding finished (ADR 0054).
   */
  firstWeekFrom: declareRecord('firstWeek.from', z.string(), { sync: 'device-only' }),
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
   * That the widget hint was on screen on this device, once ever (ADR 0054).
   * The key keeps its first name, so a device that showed it shows it no more.
   */
  widgetHintShown: declareRecord('game.widgetHintOffered', z.literal(true), {
    sync: 'device-only',
  }),
  /**
   * The Best result of each Game Mode, one record per mode, by mode id: the
   * best result of one finished Game in it, Rounds passed or, in a mode with
   * no Lives, right answers. The Game keeps a 15-Round mode within 0–15; a
   * mode with no Round limit has no upper bound. Without the record, no Game
   * in the mode has finished yet. Sync keeps the higher of two devices'
   * results (ADR 0052).
   */
  gameBest: declareRecords('game.best.', z.number().int().nonnegative(), { sync: 'highest' }),
  /**
   * The letters typed into the Daily Crossword and the local date of its day:
   * each letter by its cell, `row,column`. Only today's day counts; a new day
   * starts an empty grid. It stays on the device, with no Sync (ADR 0052). A
   * new key, so no migration.
   */
  crosswordProgress: declareRecord(
    'crossword.progress',
    z.object({ date: z.iso.date(), letters: z.record(z.string(), z.string()) }),
    { sync: 'device-only' },
  ),
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
  /**
   * What this device counted for the Community Counters, one record per
   * Entry, by Entry id: the mark it counted, or none, and whether it counted
   * the Entry saved (ADR 0060). A device starts with none at the update, so
   * nothing from before it is ever counted. It stays on the device: what one
   * device counted is not the Account's. A new key, so no migration.
   */
  countersCounted: declareRecords(
    'counters.counted.',
    z.object({ mark: z.enum(['known', 'unknown']).nullable(), saved: z.boolean() }),
    { sync: 'device-only' },
  ),
  /**
   * The Community Counter changes counted and not yet sent, one record per
   * Entry, by Entry id: the change of its known, unknown and saved counts,
   * merged (ADR 0060). It stays on the device. A new key, so no migration.
   */
  countersUnsent: declareRecords(
    'counters.unsent.',
    z.object({
      known: CounterChangeSchema,
      unknown: CounterChangeSchema,
      saved: CounterChangeSchema,
    }),
    { sync: 'device-only' },
  ),
  /**
   * The Community Counters this device read from the backend, one record per
   * Entry, by Entry id: its known, unknown and saved counts and when they
   * were read, kept for 24 hours (ADR 0060). It stays on the device: the
   * server's numbers are no reader's own. A new key, so no migration.
   */
  countersRead: declareRecords(
    'counters.read.',
    z.object({
      readAt: InstantSchema,
      known: z.int().nonnegative(),
      unknown: z.int().nonnegative(),
      saved: z.int().nonnegative(),
    }),
    { sync: 'device-only' },
  ),
  /** The Sync cursor: the server's sequence number of the last record pulled; without it, no sync has pulled yet. */
  syncCursor: declareRecord('sync.cursor', z.number().int().nonnegative(), {
    sync: 'device-only',
  }),
  /**
   * The instant the last sync of this device's Session went through, for the
   * status line; without it, none has. Forgotten with the cursor when the
   * Session ends.
   */
  syncSyncedAt: declareRecord('sync.syncedAt', InstantSchema, { sync: 'device-only' }),
  /**
   * The Mistake Reports not yet sent, oldest first, at most
   * `MISTAKE_REPORT_QUEUE_SIZE` (ADR 0056). They stay on the device, with
   * no Sync. A new key, so no migration.
   */
  mistakeReportQueue: declareRecord(
    'reports.queue',
    z.array(MistakeReportSchema).max(MISTAKE_REPORT_QUEUE_SIZE),
    { sync: 'device-only' },
  ),
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
 * Whether the record under the key syncs: last write wins, `union` or
 * `highest`. A `device-only` record and a key the schema doesn't declare
 * don't.
 */
export function syncs(key: string): boolean {
  const mark = syncMarkOf(key);
  return mark !== undefined && mark !== 'device-only';
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
  // 0.8.9: the installed marker. A store that holds a record besides its schema
  // version was kept by this install before the marker, so its Session stays;
  // a new store holds none, so the Account forgets a Session left from an
  // earlier install.
  {
    version: 5,
    async migrate({ list }) {
      const records = await list('');
      const kept = [...records.keys()].some((key) => key !== SCHEMA_VERSION_KEY);
      return new Map(kept ? [[INSTALLED_KEY, JSON.stringify(true)]] : []);
    },
  },
  // 0.8.12: a Best result per Game Mode (ADR 0052). The single `game.best` of
  // every mode becomes the Best result of «Вгадай слово», under a new key that
  // syncs as `highest`, with a pending change from the first-sign-in time so
  // the Account gets it too; `game.best` stays as it is and is no longer read.
  {
    version: 6,
    async migrate({ get }) {
      const text = await get('game.best');
      const best = z
        .number()
        .int()
        .min(0)
        .max(15)
        .safeParse(text === undefined ? undefined : parseJson(text));
      if (!best.success) return new Map();
      const value = JSON.stringify(best.data);
      return new Map([
        ['game.best.guess-word', value],
        [
          'sync.pending.game.best.guess-word',
          JSON.stringify({ changedAt: new Date(0).toISOString(), value }),
        ],
      ]);
    },
  },
];
