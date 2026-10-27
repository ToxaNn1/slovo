import { z } from 'zod';

import { TextSchema } from '../shared';

/** Asking for a Word by Mood. The Moods themselves are listed in the Edition config. */
export const MoodStringsSchema = z.strictObject({
  /** The 🎲 button in the «Головна» header and the screen title. */
  title: TextSchema,
  /** Under a disabled mood chip, and its VoiceOver hint: none of the mood's Words is Eligible. */
  noEligibleWord: TextSchema,
});
