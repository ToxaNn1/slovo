import { z } from 'zod';

import { hasNoRepeats, SourceSchema, TextSchema } from './shared';

/**
 * A Correction id: opaque, assigned when the Correction is authored and never
 * reused. The `c_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const CorrectionIdSchema = z
  .string()
  .regex(/^c_[a-z0-9]+$/, 'Expected a Correction id: c_ followed by lowercase letters and digits');

/**
 * Why a form is non-standard. A `wrongStress` Correction, a stress trap,
 * writes its Stress into its texts with the combining acute mark after the
 * stressed vowel (ADR 0045). A `paronym` Correction swaps a word for its
 * look-alike, such as «ефективна сукня» for «ефектна сукня».
 */
export const CorrectionTypeSchema = z.enum([
  'russianism',
  'calque',
  'surzhyk',
  'officialese',
  'anglicism',
  'wrongStress',
  'paronym',
]);

export type CorrectionType = z.infer<typeof CorrectionTypeSchema>;

/** The same sentence said the common, non-standard way and the standard way. */
export const ExamplePairSchema = z.strictObject({
  nonStandard: TextSchema,
  standard: TextSchema,
});

export type ExamplePair = z.infer<typeof ExamplePairSchema>;

/**
 * A Correction as authored in an Edition's content and as returned by the
 * Core: a non-standard form people commonly use, paired with its standard
 * equivalents (the main one first) and a short neutral explanation.
 *
 * `kind` tells Entries apart. Authored files may leave it out, because the
 * folder already says what they hold. `retired` defaults to false; a Retired
 * Correction stays reachable by id but is left out like a Retired Word.
 */
export const CorrectionSchema = z.strictObject({
  kind: z.literal('correction').default('correction'),
  id: CorrectionIdSchema,
  nonStandardForm: TextSchema,
  correctionType: CorrectionTypeSchema,
  standardEquivalents: z
    .array(TextSchema)
    .min(1)
    .refine(hasNoRepeats, 'Standard equivalents must not repeat'),
  explanation: TextSchema,
  examplePair: ExamplePairSchema,
  /** One of the Edition's Categories of Corrections, a list apart from the Words' (ADR 0050). */
  categoryId: z.string().min(1),
  sources: z.array(SourceSchema).min(1),
  retired: z.boolean().default(false),
});

/** A Correction with every default filled in, as the Core returns it. */
export type Correction = z.output<typeof CorrectionSchema>;

/** A Correction as authored, where defaulted fields may be left out. */
export type CorrectionInput = z.input<typeof CorrectionSchema>;
