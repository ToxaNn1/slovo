import { RarityRangeSchema, TextSizeSchema, ThemeSchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** The most characters the reader's name holds. */
export const READER_NAME_AT_MOST = 24;

/** How many characters a name holds: code points, so an emoji or another astral character is one. */
export function readerNameLength(name: string): number {
  return Array.from(name).length;
}

/** The reader's name as stored: already trimmed, never empty, at most {@link READER_NAME_AT_MOST} characters. */
const ReaderNameSchema = z
  .string()
  .min(1)
  .refine((name) => readerNameLength(name) <= READER_NAME_AT_MOST)
  .refine((name) => name === name.trim());

/** The records of the Settings. */
export const settingsRecords = {
  /** The user's Theme. */
  theme: declareRecord('settings.theme', ThemeSchema),
  /**
   * Reserved (ADR 0013): the user's S…XL font size before the three-step text
   * size. The S…XL scale is gone and only the user state migration
   * to `settings.textSize` reads it; it stays declared so the key is never
   * given to another record.
   */
  fontSize: declareRecord('settings.fontSize', z.enum(['S', 'M', 'L', 'XL'])),
  /**
   * The user's three-step text size. A new encoding takes a new
   * key (ADR 0013). It syncs last write wins like the Theme (ADR 0041);
   * without it, the Edition's default.
   */
  textSize: declareRecord('settings.textSize', TextSizeSchema),
  /**
   * The reader's name on the Profile: trimmed, 1 to
   * {@link READER_NAME_AT_MOST} characters. It syncs last write wins like the
   * Theme (ADR 0041); without it, the reader has no name.
   */
  readerName: declareRecord('settings.readerName', ReaderNameSchema),
  /** Whether the user has haptics on. It stays on the device, which may have no haptics. */
  vibration: declareRecord('settings.vibration', z.boolean(), { sync: 'device-only' }),
  /** Whether the user has «Звуки» on. It stays on the device, like Vibration. */
  sounds: declareRecord('settings.sounds', z.boolean(), { sync: 'device-only' }),
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
   * Whether the user has «Сезонний декор» on. It syncs last write
   * wins like the Theme (ADR 0041); a new key needs no migration, since
   * without it Seasonal Decor is on.
   */
  seasonalDecor: declareRecord('settings.seasonalDecor', z.boolean()),
  /**
   * The id of the Narrator Voice the reader chose on «Голос диктора». It syncs last write wins like the Theme (ADR 0041); without it
   * the Edition's default voice reads, as for an id the Edition no longer
   * declares.
   */
  narratorVoice: declareRecord('settings.narratorVoice', z.string().min(1)),
  /**
   * The Rarity Range the user chose (ADR 0156), «від 1 до 5» to «лише 3», the
   * one «Рідкість» setting every surface obeys; without it, from 1 to the
   * Edition's default top. It syncs last write wins like the Theme (ADR 0041),
   * both ends in one record, so no merge splits them. Schema version 9 moves
   * the Rarity Ceiling of 1.0, `settings.rarityCeiling`, here as its top.
   */
  rarityRange: declareRecord('settings.rarityRange', RarityRangeSchema),
  /**
   * Whether the user has «Ділитися анонімною статистикою» on: this device
   * counts and sends its Community Counters. It stays on the
   * device, since syncing it would tie the counters to an Account; a new key
   * needs no migration, since without it sharing is on.
   */
  shareCounters: declareRecord('settings.shareCounters', z.boolean(), { sync: 'device-only' }),
  /**
   * That the statistics consent waits for this reader's answer (ADR 0204):
   * `shareCounters` was written off for a new reader of the EEA, and the
   * onboarding asks until they choose. It stays on the device, like the
   * switch it stands beside; without it, nothing is asked.
   */
  statisticsConsentPending: declareRecord('settings.statisticsConsentPending', z.literal(true), {
    sync: 'device-only',
  }),
  /**
   * Whether the user has «Менше руху» on. It stays on the device,
   * like the system's Reduce Motion it joins; a new key needs no migration,
   * since without it the full motion plays.
   */
  reduceMotion: declareRecord('settings.reduceMotion', z.boolean(), { sync: 'device-only' }),
  /**
   * The Daily Limit of 0.9, retired in 1.0 for the Daily Goal
   * (ADR 0066): no longer read, and kept declared so it still syncs last
   * write wins between devices on an older app.
   */
  dailyLimit: declareRecord(
    'settings.dailyLimit',
    z.union([z.literal('off'), z.literal(10), z.literal(20), z.literal(30)]),
  ),
};
