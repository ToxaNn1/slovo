import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The Word of the Day archive in «Збережене»: its card and its list. */
export const WordOfTheDayArchiveStringsSchema = z.strictObject({
  /** The name of the archive: the list's title and the Saved tab's card. */
  title: TextSchema,
  /** How many days the archive holds, as VoiceOver reads the count. */
  count: PluralSchema,
  /** What VoiceOver reads for the archive's card of the Saved tab. Takes `{count}`, the count in words. */
  cardLabel: templateOf('count'),
  /** The empty list. */
  empty: z.strictObject({ title: TextSchema, message: TextSchema }),
});
