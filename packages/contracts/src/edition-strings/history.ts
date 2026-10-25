import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of History: the list, its day headings, kinds and relative times, the clear confirmation and the Saved card. */
export const HistoryStringsSchema = z.strictObject({
  /** The name of History: the list's title and the Saved tab's card. */
  title: TextSchema,
  /** How many Entries History holds, as VoiceOver reads the count. */
  count: PluralSchema,
  /** What VoiceOver reads for the History card of the Saved tab. Takes `{count}`, the count in words. */
  cardLabel: templateOf('count'),
  /** The note beside the title: how many Entries History keeps. Takes `{count}`. */
  limit: templateOf('count'),
  /** The empty list. */
  empty: z.strictObject({ title: TextSchema, message: TextSchema }),
  /** The action that clears History and its confirmation, a system alert. */
  clear: z.strictObject({
    /** The action beside the title. */
    action: TextSchema,
    /** The same action as VoiceOver reads it, naming what it clears. */
    actionLabel: TextSchema,
    title: TextSchema,
    message: TextSchema,
    /** The destructive button. */
    confirm: TextSchema,
    cancel: TextSchema,
  }),
  /** What a row says about its Entry, on the right of the row. */
  kinds: z.strictObject({
    word: TextSchema,
    correction: TextSchema,
    wordOfTheDay: TextSchema,
    /** An Idiom of each Idiom Type. */
    idiom: TextSchema,
    placeName: TextSchema,
    proverb: TextSchema,
  }),
  /**
   * A row's kind beside its time on the right of the row, where Collections
   * and «Вчу» put when the Entry was added or is next due. Takes `{kind}` and
   * `{time}`.
   */
  kindBeside: templateOf('kind', 'time'),
  /** The headings that group the list by day. The screen draws them in capitals. */
  days: z.strictObject({
    today: TextSchema,
    yesterday: TextSchema,
    /** A day of this year. Takes `{day}` and `{month}`. */
    date: templateOf('day', 'month'),
    /** A day of another year. Takes `{day}`, `{month}` and `{year}`. */
    dateInYear: templateOf('day', 'month', 'year'),
    /** The month names as a date takes them, January first. */
    months: z.array(TextSchema).length(12),
  }),
  /** How long ago an Entry was Seen, on the Saved card. */
  relative: z.strictObject({
    now: TextSchema,
    /** Within the hour, as the card shows it (an abbreviation). Takes `{count}`. */
    minutesAgo: PluralSchema,
    /** The same as VoiceOver reads it, in full words. Takes `{count}`. */
    minutesAgoSpoken: PluralSchema,
    /** Later today. Takes `{time}`, e.g. 09:02. */
    today: templateOf('time'),
    yesterday: templateOf('time'),
    /** An earlier day of this year. Takes `{day}`, `{month}` and `{time}`. */
    date: templateOf('day', 'month', 'time'),
    /** An earlier day of another year. Takes `{day}`, `{month}`, `{year}` and `{time}`. */
    dateInYear: templateOf('day', 'month', 'year', 'time'),
    /** The short month names, January first. */
    months: z.array(TextSchema).length(12),
  }),
});
