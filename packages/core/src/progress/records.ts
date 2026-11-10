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
export const XpSourceSchema = z.literal([
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
 * date, with its length in days, the Daily Goal the reader set from that
 * day on, a Badge earned on its date, a Badge the reader first opened, or a
 * Game Round answered wrong (ADR 0085). The kinds the ADR names besides these come with their own
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
    /** A finished Game's right answers and Rounds played, for the Badges (ADR 0085); left out before them. */
    right: z.number().int().nonnegative().optional(),
    played: z.number().int().nonnegative().optional(),
    /** A Daily Crossword solve's Solve time in seconds (ADR 0087); left out before it, read as no time. */
    solveSeconds: z.number().int().nonnegative().optional(),
    /** Whether a Daily Crossword solve used the Crossword Hint (ADR 0087); left out, no hint. */
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
   * A Daily Goal in XP, set before the Daily Goal counted Words (ADR 0074):
   * kept so the log still reads, and counted for nothing.
   */
  z.object({
    kind: z.literal('daily-goal'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    goal: z.number(),
  }),
  /** The Daily Goal in Words set from a local day on, or `null` where «Без цілі» turned it off (ADR 0074). */
  z.object({
    kind: z.literal('word-goal'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    goal: DailyGoalSchema.nullable(),
  }),
  /** The day's Seen Words reached its Daily Goal; one per local date by its id (ADR 0074). */
  z.object({ kind: z.literal('goal-met'), date: LocalDateKeySchema, at: InstantSchema }),
  z.object({
    kind: z.literal('badge'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    badge: z.string(),
  }),
  /** The reader opened an earned Badge's sheet or stamp, which ends its «НОВА» mark; one per Badge by its id (ADR 0085). */
  z.object({
    kind: z.literal('badge-opened'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    badge: z.string(),
  }),
  /** A Game Round answered wrong in its Game Mode, which earns no XP and breaks a run of right answers (ADR 0085). */
  z.object({
    kind: z.literal('wrong-answer'),
    date: LocalDateKeySchema,
    at: InstantSchema,
    mode: z.string(),
  }),
]);

const XpRecordSchema = StoredXpRecordSchema.transform((record): XpRecord =>
  record.kind === 'xp' ? xpEntryOf(record) : record,
);

type StoredXpRecord = z.infer<typeof StoredXpRecordSchema>;
/** One record of the XP log in memory: an XP entry holds only the fields of its own source. */
export type XpRecord = XpEntry | Exclude<StoredXpRecord, { kind: 'xp' }>;
export type XpSource = z.infer<typeof XpSourceSchema>;

/** The records of the progress: Active Days, the XP log and the reported Streak break. */
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
   * The last day of the Streak a missed day broke, once the Analytics event of
   * that break is emitted, so a later app run emits it no more. Without it, no
   * break is reported yet. It stays on the device, like the events.
   */
  streakBrokenReported: declareRecord('progress.streakBrokenReported', LocalDateKeySchema, {
    sync: 'device-only',
  }),
};
