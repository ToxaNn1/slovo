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
  /** The line naming the Correction's sources under the example pair, e.g. "Джерело: {source}". */
  source: templateOf('source'),
  /** A Correction's row in any list, under its standard equivalent, e.g. "замість «{form}»". */
  insteadOf: templateOf('form'),
  /** Self-check: the question under a hidden card's non-standard form, e.g. "Як правильно?". */
  howToSay: TextSchema,
  /** Self-check: the button that reveals a hidden Correction card's right form, e.g. "Показати". */
  reveal: TextSchema,
  /** The heading over a Correction's literary uses, e.g. "Як пишуть насправді". */
  literaryUses: TextSchema,
  /** The line under a literary use naming its author and work, e.g. "{author}, «{work}»". */
  literaryUseSource: templateOf('author', 'work'),
  /** The same line when the work's year is known, e.g. "{author}, «{work}», {year}". */
  literaryUseSourceWithYear: templateOf('author', 'work', 'year'),
});
