import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The texts of the onboarding: the welcome, the Mix step and the notifications step. */
export const OnboardingStringsSchema = z.strictObject({
  /** Ends the onboarding from any step, keeping what was already chosen. */
  skip: TextSchema,
  /** The overline of a step, e.g. «КРОК 2 З 3». Takes `{step}` and `{total}`. */
  step: templateOf('step', 'total'),
  /** The same as VoiceOver reads it. Takes `{step}` and `{total}`. */
  stepLabel: templateOf('step', 'total'),
  /** Step 1. */
  welcome: z.strictObject({
    /** The Edition's promise, under the hero Word. */
    title: TextSchema,
    subtitle: TextSchema,
    start: TextSchema,
  }),
  /** Step 2: the Mix, with the chips and the Corrections switch of the Mix screen. */
  mix: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    next: TextSchema,
  }),
  /** Step 3: the sample notification, the times and the permission. */
  notifications: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    /** What VoiceOver reads before the sample notification, so it is not taken for a real one. */
    sample: TextSchema,
    /** Asks iOS for permission, then ends the onboarding. */
    allow: TextSchema,
    /** Ends the onboarding without asking. */
    later: TextSchema,
  }),
});
