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
  /** The Settings row that takes the test again. */
  retake: TextSchema,
  /** The result screen. Takes `{n}`, the Rarity Floor. */
  result: templateOf('n'),
});
