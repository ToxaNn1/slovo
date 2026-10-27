import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The Search screen, opened by the magnifier in the «Головна» header. */
export const SearchStringsSchema = z.strictObject({
  /** The screen title and the magnifier's VoiceOver label. */
  title: TextSchema,
  /** Clears the recent queries. */
  clear: TextSchema,
  /** The heading of each group of results. */
  groups: z.strictObject({
    words: TextSchema,
    corrections: TextSchema,
    idioms: TextSchema,
    synonymRows: TextSchema,
    tips: TextSchema,
    /** Words whose Definition holds the query and Synonym Rows that hold it. */
    byMeaning: TextSchema,
  }),
  /** Shown when no group has a result. */
  nothingFound: TextSchema,
  /** What VoiceOver reads for a result. Takes `{kind}` and `{text}`. */
  resultLabel: templateOf('kind', 'text'),
});
