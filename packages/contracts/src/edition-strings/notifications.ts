import { z } from 'zod';

import { TextSchema } from '../shared';

/**
 * The texts of Settings › Сповіщення: the switch, the two Notification times
 * (ADR 0200), the sound switch, the ask for permission and the
 * denied-permission state.
 */
export const NotificationsStringsSchema = z.strictObject({
  /** The screen's title; the name of the Settings row and of the switch on top of the screen. */
  title: TextSchema,
  /** The Settings row's value while off, or while permission is denied or not asked yet; the Reminder row's value with no Reminder. */
  off: TextSchema,
  /** The row of the Word's time. */
  word: TextSchema,
  /** The row of the Reminder's time. */
  reminder: TextSchema,
  /** The one-line hint when a picked time would put the Reminder at or before the Word. */
  orderHint: TextSchema,
  /** The label of the time picker. */
  pickerLabel: TextSchema,
  /** The button that keeps the picked time and closes the picker. */
  done: TextSchema,
  /** The button that closes the picker without a pick. */
  cancel: TextSchema,
  /** The switch for the notification sound. */
  sound: TextSchema,
  /** The button that asks for permission while it is not asked yet. */
  enable: TextSchema,
  /** When iOS has denied permission. */
  denied: z.strictObject({
    /** The line above the times. */
    message: TextSchema,
    /** The row that opens the app's iOS settings. */
    openSettings: TextSchema,
  }),
});
