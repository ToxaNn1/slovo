import { z } from 'zod';

import { TextSchema } from '../shared';

export const SynonymRowCardStringsSchema = z.strictObject({
  /** The chip beside the dominant that names the kind, e.g. "синоніми": the kicker over it. */
  chip: TextSchema,
  /** What VoiceOver reads for the dominant and the whole row, with {dominant} and {members}. */
  heading: TextSchema,
  /** What VoiceOver reads for the dominant alone under Self-check, with {dominant}. */
  concealedHeading: TextSchema,
  /** The line naming the row's sources, with {source}. */
  source: TextSchema,
  /** The name of a page of members on the tabbed card, with {page} and {pages}, e.g. "Ряд · 1/2" (ADR 0114). */
  page: TextSchema,
});
