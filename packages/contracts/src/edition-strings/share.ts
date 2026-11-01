import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, templateOf } from './shared';

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
    /** A week within one month, e.g. «20–26 жовтня». Takes `{from}` and `{to}`, days of the month, and `{month}`, one of `dates.months`. */
    week: templateOf('from', 'to', 'month'),
    /** A week across two months, e.g. «27 жовтня – 2 листопада». Takes `{from}`, `{fromMonth}`, `{to}` and `{toMonth}`. */
    weekAcrossMonths: templateOf('from', 'fromMonth', 'to', 'toMonth'),
  }),
  /** The day of a progress Share Card or of a Daily Crossword's, as its overline, e.g. «1 листопада». Takes `{day}` and `{month}`, one of `dates.months`. */
  day: templateOf('day', 'month'),
  /** The Share Card of a Level reached. */
  level: z.strictObject({
    title: TextSchema,
    /** The Level's number, e.g. «Рівень 5». Takes `{level}`; the Level's name goes under it. */
    headline: templateOf('level'),
  }),
  /** The Share Card of a Badge earned, with the Badge's name under its title. */
  badge: z.strictObject({ title: TextSchema }),
  /** The Share Card of a Streak milestone. */
  streak: z.strictObject({
    title: TextSchema,
    /** The Streak's length in every plural form, e.g. «7 днів поспіль». Takes `{count}`. */
    headline: pluralOf(),
  }),
  /** The Share Card of a solved Daily Crossword: its grid with no letters, so it gives no answer away. */
  dailyCrossword: z.strictObject({
    title: TextSchema,
    /** What VoiceOver reads of the empty grid. */
    grid: TextSchema,
  }),
});
