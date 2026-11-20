import { z } from 'zod';

import { declareRecord, declareRecords } from '../user-state/user-state-record';

/** The records of the Game. */
export const gameRecords = {
  /**
   * Reserved (ADR 0013): that the old widget hint was on screen on
   * this device. The widget hint is gone and nothing reads or writes
   * the record; it stays declared so user state that holds it opens as before
   * and the key is never given to another record. Device-only, with no Sync.
   */
  widgetHintShown: declareRecord('game.widgetHintOffered', z.literal(true), {
    sync: 'device-only',
  }),
  /**
   * Reserved (ADR 0013): the Best result of each Game Mode as it was first
   * counted it, Rounds passed in a mode with Lives. The Best result counts
   * right answers now, a meaning a synced record never takes in place, so it
   * moved to `gameBest`; nothing reads or writes this record; it stays
   * declared so user state that holds it opens and syncs as before and the
   * key is never given to another record.
   */
  gameBestRoundsPassed: declareRecords('game.best.', z.number().int().nonnegative(), {
    sync: 'highest',
  }),
  /**
   * The Best result of each Game Mode, one record per mode, by mode id: the
   * most right answers of one finished Game in it. The Game keeps
   * a 15-Round mode within 0–15; a mode with no Round limit has no upper
   * bound. Without the record, no Game in the mode has finished yet. Sync
   * keeps the higher of two devices' results.
   */
  gameBest: declareRecords('game.bestRight.', z.number().int().nonnegative(), { sync: 'highest' }),
  /**
   * Reserved (ADR 0013): the letters typed into the typed Daily Crossword of
   * each by its cell, `row,column`, and the local date of its day.
   * The typed crossword is gone and nothing reads or writes the
   * record; it stays declared so user state that holds it opens as before and
   * the key is never given to another record. Device-only, with no Sync.
   */
  crosswordProgress: declareRecord(
    'crossword.progress',
    z.object({ date: z.iso.date(), letters: z.record(z.string(), z.string()) }),
    { sync: 'device-only' },
  ),
  /**
   * Reserved (ADR 0013): the hidden Words found in the traced Daily Crossword,
   * by Word id, with the local date and the puzzle's fingerprint.
   * The traced crossword is gone and nothing reads or writes the
   * record; it stays declared so user state that holds it opens as before and
   * the key is never given to another record. Device-only, with no Sync.
   */
  tracedCrosswordProgress: declareRecord(
    'crossword.traced',
    z.object({ date: z.iso.date(), puzzle: z.string(), found: z.array(z.string()) }),
    { sync: 'device-only' },
  ),
  /**
   * The progress of the crossing Daily Crossword: the local date of its day,
   * the fingerprint of its puzzle, the letters the reader filled by cell
   * (`row,column`), the ids of the Words solved, whether the Crossword Hint
   * was used and the seconds it was on screen. Only today's puzzle counts; a
   * new day, or another puzzle the same day, starts empty. It stays on the
   * device, with no Sync.
   */
  crossingCrosswordProgress: declareRecord(
    'crossword.crossing',
    z.object({
      date: z.iso.date(),
      puzzle: z.string(),
      filled: z.record(z.string(), z.string()),
      solved: z.array(z.string()),
      hinted: z.boolean(),
      seconds: z.number().int().nonnegative(),
    }),
    { sync: 'device-only' },
  ),
};
