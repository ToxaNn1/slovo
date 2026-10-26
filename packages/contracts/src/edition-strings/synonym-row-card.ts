import { z } from 'zod';

import { TextSchema } from '../shared';

export const SynonymRowCardStringsSchema = z.strictObject({
  /** The chip beside the dominant that names the kind, e.g. "синоніми". */
  chip: TextSchema,
  /** What VoiceOver reads for the dominant and the whole row, with {dominant} and {members}. */
  heading: TextSchema,
  /** What VoiceOver reads for the dominant alone under Self-check, with {dominant}. */
  concealedHeading: TextSchema,
  /** The line naming the row's sources, with {source}. */
  source: TextSchema,
});
