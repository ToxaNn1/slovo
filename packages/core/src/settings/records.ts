import { FontSizeSchema, ThemeSchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** The records of the Settings. */
export const settingsRecords = {
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
};
