import { z } from 'zod';

import { SourceOutputSchema, SourceSchema, EntryTextSchema } from './shared';
import { ExampleOutputSchema, ExampleSchema } from './word';

/**
 * A Tip id: opaque, assigned when the Tip is authored and never reused. The
 * `t_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const TipIdSchema = z
  .string()
  .regex(/^t_[a-z0-9]+$/, 'Expected a Tip id: t_ followed by lowercase letters and digits');

/** The most characters a Tip's explanation may have. */
export const TIP_EXPLANATION_MAX_LENGTH = 300;

/** A Tip's own Game question: a prompt with one right answer and three wrong ones. */
const tipGameQuestionShape = {
  prompt: EntryTextSchema,
  rightAnswer: EntryTextSchema,
  wrongAnswers: z.tuple([EntryTextSchema, EntryTextSchema, EntryTextSchema]),
};

export const TipGameQuestionSchema = z.strictObject(tipGameQuestionShape);

const TipGameQuestionOutputSchema = z.object(tipGameQuestionShape);

export type TipGameQuestion = z.infer<typeof TipGameQuestionSchema>;

/**
 * Where a Tip's rule does not hold (ADR 0120): a short text in reading prose
 * («Не ставимо перед «о»…») and the words it names, which its card shows in
 * chips under the tab «Винятки».
 */
const tipExceptionsShape = {
  explanation: EntryTextSchema.max(TIP_EXPLANATION_MAX_LENGTH),
  words: z.array(EntryTextSchema).min(1),
};

export const TipExceptionsSchema = z.strictObject(tipExceptionsShape);

const TipExceptionsOutputSchema = z.object(tipExceptionsShape);

export type TipExceptions = z.infer<typeof TipExceptionsSchema>;

// The fields of a Tip, with its nested schemas strict for content and open for outputs.
const tipShape = (
  example: typeof ExampleSchema | typeof ExampleOutputSchema,
  exceptions: typeof TipExceptionsSchema | typeof TipExceptionsOutputSchema,
  gameQuestion: typeof TipGameQuestionSchema | typeof TipGameQuestionOutputSchema,
  source: typeof SourceSchema | typeof SourceOutputSchema,
) => ({
  kind: z.literal('tip').default('tip'),
  id: TipIdSchema,
  title: EntryTextSchema,
  nonStandardForm: EntryTextSchema.optional(),
  standardForm: EntryTextSchema,
  explanation: EntryTextSchema.max(TIP_EXPLANATION_MAX_LENGTH),
  example: example.optional(),
  exceptions: exceptions.optional(),
  sources: z.array(source).min(1),
  gameQuestion,
  retired: z.boolean().default(false),
});

/**
 * A Tip as authored in an Edition's content and as returned by the Core: a
 * rule of good speech with a title («Котра година?»), its standard form, an
 * explanation of at most 300 characters, at least one source and its own Game
 * question; optionally the non-standard form it replaces, an example and its
 * exceptions (ADR 0120). A
 * Tip with no non-standard form shows only the right way. It has no Category,
 * rarity or Pronunciation (ADR 0051).
 *
 * `kind` tells Entries apart. Authored files may leave it out, because the
 * folder already says what they hold. `retired` defaults to false; a Retired
 * Tip stays reachable by id but is left out like a Retired Word.
 */
export const TipSchema = z.strictObject(
  tipShape(ExampleSchema, TipExceptionsSchema, TipGameQuestionSchema, SourceSchema),
);

/** A Tip as an output carries it: open to fields a later backend adds (ADR 0031). */
export const TipOutputSchema = z.object(
  tipShape(
    ExampleOutputSchema,
    TipExceptionsOutputSchema,
    TipGameQuestionOutputSchema,
    SourceOutputSchema,
  ),
);

/** A Tip with every default filled in, as the Core returns it. */
export type Tip = z.output<typeof TipSchema>;

/** A Tip as authored, where defaulted fields may be left out. */
export type TipInput = z.input<typeof TipSchema>;
