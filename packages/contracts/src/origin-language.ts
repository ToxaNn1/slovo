import { z } from 'zod';

import { KebabCaseIdSchema } from './shared';

/**
 * A language Words come from, for a Word's `origin` and «Звідки слово»
 * (ADR 0052). The code is an ISO 639 code where one fits the language, e.g.
 * `la` or `trk`, otherwise a lowercase English word, e.g. `proto-slavic` or
 * `other`; the name is in the Edition's language.
 */
export const OriginLanguageSchema = z.strictObject({
  code: KebabCaseIdSchema,
  name: z.string().min(1),
});

export type OriginLanguage = z.infer<typeof OriginLanguageSchema>;
