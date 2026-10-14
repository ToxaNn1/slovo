import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/**
 * The texts of Settings › Сповіщення, which the onboarding's notifications
 * step shares: the times, the sound switch and the denied-permission state.
 */
export const NotificationsStringsSchema = z.strictObject({
  /** The screen's title; the name of the Settings row. */
  title: TextSchema,
  /** The Settings row's value: how many times a day. Takes `{count}`. */
  perDay: PluralSchema,
  /** The Settings row's value with no times, or with permission denied. */
  off: TextSchema,
  /** Adds a time. */
  addTime: TextSchema,
  /** Why «Додати час» is disabled at the limit. VoiceOver reads it as that button's hint. Takes `{count}`, the limit. */
  limitHint: PluralSchema,
  /** The one-line hint when the time is already in the list. */
  duplicateHint: TextSchema,
  /** What VoiceOver reads for a time in the list, e.g. «Сповіщення о 09:00». Takes `{time}`. */
  timeLabel: templateOf('time'),
  /** What VoiceOver says a tap on a time does: it changes the time. */
  change: TextSchema,
  /** The action that removes a time (a swipe, and the same for VoiceOver). */
  remove: TextSchema,
  /** The label of the time picker. */
  pickerLabel: TextSchema,
  /** The button that keeps the picked time and closes the picker. */
  done: TextSchema,
  /** The switch for the notification sound. */
  sound: TextSchema,
  /** When iOS has denied permission. */
  denied: z.strictObject({
    /** The line above the times. */
    message: TextSchema,
    /** The row that opens the app's iOS settings. */
    openSettings: TextSchema,
  }),
});
