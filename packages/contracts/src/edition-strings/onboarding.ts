import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/**
 * The texts of the onboarding (ADR 0067): the welcome, the first Word, «Хто
 * ви» and «Навіщо», and the Daily Goal. The Mix, notifications and SLOVO ID
 * texts stay for the offers that come later.
 */
export const OnboardingStringsSchema = z.strictObject({
  /** Ends the onboarding from any step, keeping what was already chosen. */
  skip: TextSchema,
  /** The overline of a step, e.g. «КРОК 2 З 4», or «З 3» with the Account off. Takes `{step}` and `{total}`. */
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
  /** Today's Word of the Day on its card, the reader's first Word. */
  firstWord: z.strictObject({
    title: TextSchema,
    next: TextSchema,
  }),
  /** «Хто ви»: its options are the Edition's questionnaire; «Пізніше» goes on without an answer. */
  who: z.strictObject({ title: TextSchema }),
  /** «Навіщо»: its options are the Edition's questionnaire. */
  why: z.strictObject({ title: TextSchema }),
  /** The Daily Goal, picked from the goals in XP. */
  dailyGoal: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    /** Sets the goal on screen and ends the onboarding. */
    done: TextSchema,
  }),
  /** The Mix, with the chips and the Corrections switch of the Mix screen. */
  mix: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    next: TextSchema,
  }),
  /** The sample notification, the times and the permission. */
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
  /** Offers SLOVO ID. The Account's name comes as `{name}`. */
  account: z.strictObject({
    title: TextSchema,
    /** Says what the Account keeps. Takes `{name}`. */
    subtitle: templateOf('name'),
    /** Opens the SLOVO ID screen. Takes `{name}`. */
    signIn: templateOf('name'),
    /** Ends the onboarding without an Account. */
    continueWithout: TextSchema,
  }),
});
