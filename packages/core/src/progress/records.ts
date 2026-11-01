import { DailyGoalSchema, RaritySchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord, declareRecords, InstantSchema } from '../user-state/user-state-record';

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
]);

/**
 * One record of the XP log (ADR 0066): its local date and instant, and what
 * it records: XP a learning action earned on its date, a Streak freeze
 * consumed for its date, a missed day it covers, a Break started on its
 * date, with its length in days, the Daily Goal the reader set from that
 * day on, or a Badge earned on its date. The kinds the ADR names besides
 * these come with their own tickets.
 */
const XpRecordSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('xp'),
    date: z.string(),
    at: InstantSchema,
    source: XpSourceSchema,
    amount: z.number().int().positive(),
    /** The Game Mode of a Round or a finished Game, for the Badges; left out before them and for other sources. */
    mode: z.string().optional(),
    /** The rarity of the Word a Round answered right asked about, for the Badges; left out for other Entries. */
    rarity: RaritySchema.optional(),
  }),
  z.object({ kind: z.literal('freeze'), date: z.string(), at: InstantSchema }),
  z.object({
    kind: z.literal('break'),
    date: z.string(),
    at: InstantSchema,
    /** The length in days, 1 to 7 (ADR 0066): a longer record, from Sync or storage, is dropped. */
    days: z.number().int().min(1).max(BREAK_DAYS_AT_MOST),
  }),
  z.object({
    kind: z.literal('daily-goal'),
    date: z.string(),
    at: InstantSchema,
    goal: DailyGoalSchema,
  }),
  z.object({ kind: z.literal('badge'), date: z.string(), at: InstantSchema, badge: z.string() }),
]);

export type XpRecord = z.infer<typeof XpRecordSchema>;
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
  streakBrokenReported: declareRecord('progress.streakBrokenReported', z.string(), {
    sync: 'device-only',
  }),
};
