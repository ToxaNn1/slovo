import { z } from 'zod';

import { CorrectionTypeSchema } from '../correction';
import { TextSchema } from '../shared';
import { templateOf } from './shared';

export const CorrectionCardStringsSchema = z.strictObject({
  /** The overline at the top of the card, e.g. "Виправлення". */
  title: TextSchema,
  /** The name of every Correction Type, e.g. "калька". */
  correctionTypes: z.record(CorrectionTypeSchema, TextSchema),
  /** The VoiceOver label of the Correction Type chip, e.g. "Тип: {type}". */
  correctionType: templateOf('type'),
  /** The label over the non-standard form, e.g. "Так часто кажуть". */
  nonStandard: TextSchema,
  /** The label over the main standard equivalent, e.g. "Українською краще". */
  standard: TextSchema,
  /** The line with the other standard equivalents, e.g. "також: {equivalents}". */
  otherEquivalents: templateOf('equivalents'),
  /** What VoiceOver says for each sentence of the example pair. */
  exampleNonStandard: templateOf('text'),
  exampleStandard: templateOf('text'),
});
