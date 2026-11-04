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
  /** What VoiceOver reads on a step's dots, e.g. «Крок 2 з 4». Takes `{step}` and `{total}`. */
  stepLabel: templateOf('step', 'total'),
  /** Step 1. */
  welcome: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    /** The Edition's promise. */
    title: TextSchema,
    subtitle: TextSchema,
    start: TextSchema,
  }),
  /** Today's Word of the Day on its card, the reader's first Word. */
  firstWord: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
    next: TextSchema,
  }),
  /** «Як добре ви знаєте мову?»: its options are the Edition's questionnaire; «Пізніше» goes on without an answer. */
  level: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
  }),
  /** «Навіщо»: its options are the Edition's questionnaire. */
  why: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
  }),
  /** The Daily Goal, picked from the goals in XP. */
  dailyGoal: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
    subtitle: TextSchema,
    /** The unit under each goal's number. */
    unit: TextSchema,
    /** Sets the goal on screen and ends the onboarding. */
    done: TextSchema,
  }),
  /** «Коли нагадати?»: a chip per time the Core offers, «Інший час» and «Без нагадувань». */
  notificationTime: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
    /** Opens the time picker. */
    otherTime: TextSchema,
    /** Leaves no Notification time. */
    none: TextSchema,
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
