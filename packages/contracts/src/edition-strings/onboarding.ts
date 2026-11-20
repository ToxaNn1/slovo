import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/**
 * The texts of the onboarding: the welcome, the first Word, «Як
 * добре ти знаєш мову?» and «Навіщо», and the Daily Goal.
 */
export const OnboardingStringsSchema = z.strictObject({
  /** Ends the onboarding from any step, keeping what was already chosen. */
  skip: TextSchema,
  /** The quiet «Пізніше» under a step's main button, which goes on without it. */
  later: TextSchema,
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
    /** The one line for a reader who is not asked: anonymous statistics are on, and where to turn them off (ADR 0204). */
    statisticsNote: TextSchema,
  }),
  /** The statistics consent of an EEA reader (ADR 0204): two equal choices, neither chosen beforehand. */
  statisticsConsent: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
    /** What is shared and what never is, and where the choice can be changed. */
    text: TextSchema,
    /** Turns «Ділитися анонімною статистикою» on. */
    allow: TextSchema,
    /** Leaves it off. */
    deny: TextSchema,
  }),
  /** Today's Word of the Day on its card, the reader's first Word. */
  firstWord: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
    next: TextSchema,
  }),
  /** «ГРАЙ!»: the Games in one screen; «Далі» goes on. */
  playStep: z.strictObject({
    /** The word the step shouts large on its red top. */
    shout: TextSchema,
    title: TextSchema,
    subtitle: TextSchema,
    next: TextSchema,
  }),
  /** «Як добре ти знаєш мову?»: its options are the Edition's questionnaire; «Пізніше» goes on without an answer. */
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
});
