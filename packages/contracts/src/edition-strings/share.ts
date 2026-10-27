import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The texts of sharing an Entry: the share button, the share sheet and the Share Card's own labels. */
export const ShareStringsSchema = z.strictObject({
  /** The action row's share button, as VoiceOver reads it: what a tap will do. */
  button: TextSchema,
  /** The title of the sheet with the Share Card's preview. */
  title: TextSchema,
  /** What the sheet's format control picks, as VoiceOver reads it before the format's name. */
  format: TextSchema,
  /** The Story format (9:16), on the format control. */
  story: TextSchema,
  /** The Square format (1:1), on the format control. */
  square: TextSchema,
  /** The sheet's primary button, which opens the system share sheet with the image. */
  share: TextSchema,
  /** The overline of the Share Card of today's Word of the Day, in place of its Category. */
  wordOfTheDay: TextSchema,
  /** The label over the non-standard form on a Correction's Share Card. */
  nonStandard: TextSchema,
  /** The label over the main standard equivalent on a Correction's Share Card. */
  standard: TextSchema,
  /** The toast when the image of the Share Card could not be made. */
  captureFailed: TextSchema,
  /** The Share Card of a Weekly Recap. */
  weeklyRecap: z.strictObject({
    /** Its title, «Мій тиждень у SLOVO». */
    title: TextSchema,
    /** A week within one month, e.g. «20–26 жовтня». Takes `{from}` and `{to}`, days of the month, and `{month}`, one of the `months`. */
    week: templateOf('from', 'to', 'month'),
    /** A week across two months, e.g. «27 жовтня – 2 листопада». Takes `{from}`, `{fromMonth}`, `{to}` and `{toMonth}`. */
    weekAcrossMonths: templateOf('from', 'fromMonth', 'to', 'toMonth'),
    /** The month names as the dates use them, January first. */
    months: z.array(TextSchema).length(12),
    /** The label of the Entries Seen in the week. */
    seen: TextSchema,
    /** The label of the Favorites added in the week. */
    saved: TextSchema,
    /** The label of the Known marks set in the week. */
    known: TextSchema,
    /** The label of the Streak. */
    streak: TextSchema,
  }),
});
