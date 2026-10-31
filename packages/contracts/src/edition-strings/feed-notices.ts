import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf } from './shared';

/** A first-week card of days 1 to 6: what the app offers that day. */
const FirstWeekCardSchema = z.strictObject({ title: TextSchema, text: TextSchema });

/** The Feed Notices: Feed cards that are not Entries. */
export const FeedNoticesStringsSchema = z.strictObject({
  /** The Weekly Recap card: its title and the labels of its four numbers, which its Share Card takes too. */
  weeklyRecap: z.strictObject({
    title: TextSchema,
    /** The label of the Entries Seen in the week. */
    seen: TextSchema,
    /** The label of the Favorites added in the week. */
    saved: TextSchema,
    /** The label of the Known marks set in the week. */
    known: TextSchema,
    /** The label of the Streak. */
    streak: TextSchema,
  }),
  /** Asks about yesterday's Word of the Day. */
  yesterday: z.strictObject({ title: TextSchema }),
  /** The card at the Daily Limit. */
  dailyLimit: z.strictObject({
    message: TextSchema,
    /** Hides the card until tomorrow. */
    keepGoing: TextSchema,
  }),
  /** The intro cards of the first week. */
  firstWeek: z.strictObject({
    /** Closes a card for good. */
    close: TextSchema,
    /** The title of the seventh day's card, beside the Streak. */
    lastDayTitle: TextSchema,
    /** The cards of days 1 to 6, in order: Знаю / Не знаю, Гра, Збережене і Колекції, Мікс, Віджет, Перевір себе. */
    days: z.tuple([
      FirstWeekCardSchema,
      FirstWeekCardSchema,
      FirstWeekCardSchema,
      FirstWeekCardSchema,
      FirstWeekCardSchema,
      FirstWeekCardSchema,
    ]),
    /** The text of the seventh day's card. Takes `{count}`, the Streak. */
    lastDayText: pluralOf(),
    /** The seventh day's text for a reader who hides the Streak, so it names no Streak. */
    lastDayTextNoStreak: TextSchema,
  }),
  /** The Community Word card. */
  communityWord: z.strictObject({
    title: TextSchema,
    /** How many readers added the Entry to Favorites last week, `{count}`. */
    added: pluralOf(),
  }),
});
