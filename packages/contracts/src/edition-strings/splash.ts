import { z } from 'zod';

import { TextSchema } from '../shared';

/** The words on the splash, under the Edition's mark. */
export const SplashStringsSchema = z.strictObject({
  /** The app's name as a wordmark, e.g. "SLOVO". */
  wordmark: TextSchema,
  tagline: TextSchema,
});
