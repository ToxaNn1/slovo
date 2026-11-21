import { DailyGoalSchema, RaritySchema } from '@slovo/contracts';
import { z } from 'zod';

import {
  declareRecord,
  declareRecords,
  InstantSchema,
  LocalDateKeySchema,
} from '../user-state/user-state-record';
import { xpEntryOf, type XpEntry } from './xp-entry';

/** The most days a Break lasts (ADR 0066). */
export const BREAK_DAYS_AT_MOST = 7;

/** The learning actions XP comes from (ADR 0066). */
const XpSourceSchema = z.literal([
  'game-round',
  'game-finished',
  'game-best',
  'daily-crossword',
  'review-answer',
  'quick-question',
  'seen-word',
]);

/**
 * One record of the XP log (ADR 0066): its local date and instant, and what
 * it records: XP a learning action earned on its date, a Streak freeze
 * consumed for its date, a missed day it covers, a Break started on its
 * date, with its length in days, a Break ended early, the Daily Goal the reader set from that
 * day on, a Badge earned on its date, a Badge the reader first opened, or a
 * Game Round answered wrong. The kinds the ADR names besides these come with their own
 * tickets. The stored XP entry keeps the fields of every source; it reads as
 * the form of its own source by the rule of `xpEntryOf`.
 */
const StoredXpRecordSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('xp'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    source: XpSourceSchema,
    amount: z.number().int().positive(),
    /** The Game Mode of a Round or a finished Game, for the Badges; left out before them and for other sources. */
    mode: z.string().optional(),
    /** The rarity of the Word a Round answered right asked about, for the Badges; left out for other Entries. */
    rarity: RaritySchema.optional(),
    /** A finished Game's right answers and Rounds played, for the Badges; left out before them. */
    right: z.number().int().nonnegative().optional(),
    played: z.number().int().nonnegative().optional(),
    /** A Daily Crossword solve's Solve time in seconds; left out before it, read as no time. */
    solveSeconds: z.number().int().nonnegative().optional(),
    /** Whether a Daily Crossword solve used the Crossword Hint; left out, no hint. */
    hinted: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('freeze'), date: LocalDateKeySchema, at: InstantSchema }),
  z.object({
    kind: z.literal('break'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    /** The length in days, 1 to 7 (ADR 0066): a longer record, from Sync or storage, is dropped. */
    days: z.number().int().min(1).max(BREAK_DAYS_AT_MOST),
  }),
  /**
   * The reader ended the Break that starts on `start` early, on `date`:
   * the Break started at `startedAt` covers the days before `date` only, and
   * one started again later on that day is not ended; one per Break by its id.
   */
  z.object({
    kind: z.literal('break-end'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    start: LocalDateKeySchema,
    startedAt: InstantSchema,
  }),
  /**
   * A Daily Goal in XP, set before the Daily Goal counted Words:
   * kept so the log still reads, and counted for nothing.
   */
  z.object({
    kind: z.literal('daily-goal'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    goal: z.number(),
  }),
  /** The Daily Goal in Words set from a local day on, or `null` where «Без цілі» turned it off. */
  z.object({
    kind: z.literal('word-goal'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    goal: DailyGoalSchema.nullable(),
  }),
  /** The day's Seen Words reached its Daily Goal; one per local date by its id. */
  z.object({ kind: z.literal('goal-met'), date: LocalDateKeySchema, at: InstantSchema }),
  z.object({
    kind: z.literal('badge'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    badge: z.string(),
  }),
  /** The reader opened an earned Badge's sheet or stamp, which ends its «НОВА» mark; one per Badge by its id. */
  z.object({
    kind: z.literal('badge-opened'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    badge: z.string(),
  }),
  /** A Game Round answered wrong in its Game Mode, which earns no XP and breaks a run of right answers. */
  z.object({
    kind: z.literal('wrong-answer'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    mode: z.string(),
  }),
  // The reset marker of «Скинути прогрес»: every progress value folds only the records after the latest one.
  z.object({ kind: z.literal('reset'), date: LocalDateKeySchema, at: InstantSchema }),
]);

export const XpRecordSchema = StoredXpRecordSchema.transform((record): XpRecord =>
  record.kind === 'xp' ? xpEntryOf(record) : record,
);

type StoredXpRecord = z.infer<typeof StoredXpRecordSchema>;
/** One record of the XP log in memory: an XP entry holds only the fields of its own source. */
export type XpRecord = XpEntry | Exclude<StoredXpRecord, { kind: 'xp' }>;

/**
 * An XP day (ADR 0205): the records of the XP log of one local date, folded
 * into one record once the date is more than 30 days past, by the id each
 * record had. A row is its record without the date, without the kind of an XP
 * entry, and with its instant as `t`, the milliseconds from the date's first
 * instant read as UTC, or as `at` where it was written another way.
 */
const XpDaySchema = z.object({
  date: LocalDateKeySchema,
  rows: z.record(z.string(), z.record(z.string(), z.json())),
});

export type XpDay = z.infer<typeof XpDaySchema>;

/** The records of the progress: Active Days, the XP log, its XP days and the reported Streak break. */
export const progressRecords = {
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
   * The XP days, one record per folded day, or several for a day too large for
   * one record of Sync or folded on two devices from different records, by the
   * date, the number of its records and a hash of their ids, so two devices
   * that fold the same records make the same XP day. An XP day is never
   * changed, and they sync as a union: a record counts once by its id however
   * many XP days hold it (ADR 0205).
   */
  xpDays: declareRecords('xpDay.', XpDaySchema, { sync: 'union' }),
  /**
   * The last day of the Streak a missed day broke, once the Analytics event of
   * that break is emitted, so a later app run emits it no more. Without it, no
   * break is reported yet. It stays on the device, like the events.
   */
  streakBrokenReported: declareRecord('progress.streakBrokenReported', LocalDateKeySchema, {
    sync: 'device-only',
  }),
};
