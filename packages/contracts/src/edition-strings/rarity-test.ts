import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/**
 * The Rarity Test. Its answers read the Knowledge Mark names of `knowledge`,
 * which say the same thing.
 */
export const RarityTestStringsSchema = z.strictObject({
  /** Offers the test in onboarding after the Mix. */
  start: TextSchema,
  /** What the offer in onboarding says under its title. */
  subtitle: TextSchema,
  /** Where the test is, over the Word asked about. Takes `{n}`, its number, and `{total}`. */
  progress: templateOf('n', 'total'),
  /**
   * What VoiceOver announces when the next Word comes up: where the test is
   * and the Word. Takes `{n}`, `{total}` and `{word}`, what VoiceOver reads for the Word.
   */
  announcement: templateOf('n', 'total', 'word'),
  /** The Settings row that takes the test again. */
  retake: TextSchema,
  /** The result screen. Takes `{n}`, the Rarity Floor. */
  result: templateOf('n'),
});
