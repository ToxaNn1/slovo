import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of the «Вчу» list: its card in the Saved tab, the list, its rows and its empty state. */
export const LearningStringsSchema = z.strictObject({
  /** The name of the list: its title and the Saved tab's card. */
  title: TextSchema,
  /** How many Entries the list holds, as VoiceOver reads the count. */
  count: PluralSchema,
  /** What VoiceOver reads for the list's card in the Saved tab. Takes `{count}`, the count in words. */
  cardLabel: templateOf('count'),
  /** The line under the list. */
  footer: TextSchema,
  /** When an Entry is next due for Review, on the right of its row. */
  reviewDay: z.strictObject({
    /** Due today or since an earlier day. */
    today: TextSchema,
    tomorrow: TextSchema,
    /** Two days or more from today. Takes `{count}`, the number of days. */
    inDays: PluralSchema,
  }),
  /** The empty list. */
  empty: z.strictObject({ title: TextSchema, message: TextSchema }),
});
