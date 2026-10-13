import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of Favorites: the heart, the Favorites card of the Saved tab, the list, its rows and its empty state. */
export const FavoritesStringsSchema = z.strictObject({
  /** The name of Favorites: the list's title and the Saved tab's card. */
  title: TextSchema,
  /** How many Entries Favorites holds, as VoiceOver reads the count. */
  count: PluralSchema,
  /** What VoiceOver reads for the Favorites card of the Saved tab. Takes `{count}`, the count in words. */
  cardLabel: templateOf('count'),
  /** The heart's VoiceOver labels: what a tap will do. */
  heart: z.strictObject({ add: TextSchema, remove: TextSchema }),
  /** The line under the list. */
  footer: TextSchema,
  /** The swipe action that takes a row's Entry out of Favorites. */
  remove: TextSchema,
  /** The same action as VoiceOver reads it. Takes `{title}`, what the row leads with. */
  removeLabel: templateOf('title'),
  /** When an Entry was added, on the right of its row. */
  added: z.strictObject({
    today: TextSchema,
    yesterday: TextSchema,
    /** A day of this year. Takes `{day}` and `{month}`. */
    date: templateOf('day', 'month'),
    /** A day of another year. Takes `{day}`, `{month}` and `{year}`. */
    dateInYear: templateOf('day', 'month', 'year'),
    /** The short month names, January first. */
    months: z.array(TextSchema).length(12),
  }),
  /** The empty list. */
  empty: z.strictObject({
    title: TextSchema,
    message: TextSchema,
    /** The button that goes to the Feed. */
    toFeed: TextSchema,
  }),
});
