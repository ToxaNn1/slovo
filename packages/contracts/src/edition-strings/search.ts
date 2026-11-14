import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The Search screen, opened by the magnifier in the «Стрічка» header. */
export const SearchStringsSchema = z.strictObject({
  /** The screen title and the magnifier's VoiceOver label. */
  title: TextSchema,
  /** The placeholder of the search field on the Saved screen, which opens Search. */
  placeholder: TextSchema,
  /** The small capitals over the recent queries. */
  recent: TextSchema,
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
  /** The hint under «Нічого не знайдено»: another spelling, meaning search from three letters, and where to suggest a missing Word (board 09). */
  nothingFoundHint: TextSchema,
  /** The placeholder of the field on the Search screen (board 09). */
  inputPlaceholder: TextSchema,
  /** The button beside the field that closes the Search screen (board 09, ADR 0054). */
  cancel: TextSchema,
  /** The small capitals over the results while the query finds some (board 09). */
  found: TextSchema,
  /** The small capitals while the query is too short to search by meaning and finds nothing yet (board 09). */
  keepTyping: TextSchema,
  /** What VoiceOver reads for a result. Takes `{kind}` and `{text}`. */
  resultLabel: templateOf('kind', 'text'),
});
