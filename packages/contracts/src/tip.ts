import { z } from 'zod';

import { SourceSchema, TextSchema } from './shared';
import { ExampleSchema } from './word';

/**
 * A Tip id: opaque, assigned when the Tip is authored and never reused. The
 * `t_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const TipIdSchema = z
  .string()
  .regex(/^t_[a-z0-9]+$/, 'Expected a Tip id: t_ followed by lowercase letters and digits');

/** A Tip's own Game question: a prompt with one right answer and three wrong ones. */
export const TipGameQuestionSchema = z.strictObject({
  prompt: TextSchema,
  rightAnswer: TextSchema,
  wrongAnswers: z.tuple([TextSchema, TextSchema, TextSchema]),
});

export type TipGameQuestion = z.infer<typeof TipGameQuestionSchema>;

/**
 * A Tip as authored in an Edition's content and as returned by the Core: a
 * rule of good speech with a title («Котра година?»), its standard form, a
 * short explanation, its sources and its own Game question; optionally the
 * non-standard form it replaces and an example. A Tip with no non-standard
 * form shows only the right way. It has no Category, rarity or Pronunciation
 * (ADR 0051).
 *
 * `kind` tells Entries apart. Authored files may leave it out, because the
 * folder already says what they hold. `retired` defaults to false; a Retired
 * Tip stays reachable by id but is left out like a Retired Word.
 */
export const TipSchema = z.strictObject({
  kind: z.literal('tip').default('tip'),
  id: TipIdSchema,
  title: TextSchema,
  nonStandardForm: TextSchema.optional(),
  standardForm: TextSchema,
  explanation: TextSchema,
  example: ExampleSchema.optional(),
  sources: z.array(SourceSchema),
  gameQuestion: TipGameQuestionSchema,
  retired: z.boolean().default(false),
});

/** A Tip with every default filled in, as the Core returns it. */
export type Tip = z.output<typeof TipSchema>;

/** A Tip as authored, where defaulted fields may be left out. */
export type TipInput = z.input<typeof TipSchema>;
