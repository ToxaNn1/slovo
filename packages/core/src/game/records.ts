import { z } from 'zod';

import { declareRecord, declareRecords } from '../user-state/user-state-record';

/** The records of the Game. */
export const gameRecords = {
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
};
