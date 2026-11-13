import { z } from 'zod';

import {
  hasNoRepeats,
  SourceOutputSchema,
  SourceSchema,
  EntryTextSchema,
  WebAddressSchema,
} from './shared';

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
 * look-alike, such as «ефективна сукня» for «ефектна сукня». The order is
 * the board's, the order of the Dashboard's Correction Types rail (ADR 0105).
 */
export const CorrectionTypeSchema = z.enum([
  'surzhyk',
  'wrongStress',
  'calque',
  'officialese',
  'paronym',
  'russianism',
  'anglicism',
]);

export type CorrectionType = z.infer<typeof CorrectionTypeSchema>;

/** The mark around the standard form in a standard example sentence (ADR 0117). */
const STANDARD_FORM_MARK = '**';

/**
 * A piece of a standard example sentence: plain text, or the standard form
 * the card shows bold, such as «беремо участь» in «Ми беремо участь у конкурсі.».
 */
export type ExampleSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'standardForm'; readonly text: string };

/** A standard example sentence read for its marked standard form: its pieces in order, or why the marks are broken. */
export type ParsedStandardExample =
  | { readonly kind: 'marked'; readonly segments: readonly ExampleSegment[] }
  | { readonly kind: 'broken'; readonly problem: string };

/**
 * Reads the standard form out of a standard example sentence, where the
 * Edition's content marks it `**like this**` (ADR 0117). A standard form
 * split by other words is marked in parts: «**Взяти** це **до уваги**».
 */
export function parseStandardExample(text: string): ParsedStandardExample {
  const parts = text.split(STANDARD_FORM_MARK);
  const broken = (problem: string): ParsedStandardExample => ({ kind: 'broken', problem });
  if (parts.length === 1) return broken('Mark the standard form with ** on both sides');
  if (parts.length % 2 === 0) return broken('Close every ** mark around the standard form');
  if (parts.some((part) => part.includes('*'))) return broken('Write * only in ** marks');
  const segments: ExampleSegment[] = [];
  for (const [index, part] of parts.entries()) {
    const standardForm = index % 2 === 1;
    if (standardForm && part.trim() === '')
      return broken('Put the standard form between the ** marks');
    if (part !== '') segments.push({ kind: standardForm ? 'standardForm' : 'text', text: part });
  }
  return { kind: 'marked', segments };
}

/**
 * The same sentence said the common, non-standard way and the standard way.
 * The standard sentence marks its standard form `**like this**`, the part the
 * card shows bold (ADR 0117); the marks stay in the text wherever it is kept.
 */
const examplePairShape = {
  nonStandard: EntryTextSchema,
  standard: EntryTextSchema.superRefine((text, context) => {
    const parsed = parseStandardExample(text);
    if (parsed.kind === 'broken') context.addIssue({ code: 'custom', message: parsed.problem });
  }),
};

export const ExamplePairSchema = z.strictObject(examplePairShape);

const ExamplePairOutputSchema = z.object(examplePairShape);

export type ExamplePair = z.infer<typeof ExamplePairSchema>;

/**
 * A real use of a Correction's standard form in literature, quoted with its
 * author and work. Only public-domain texts: the build refuses one before
 * 1 January of the 71st year after the author's death (ADR 0045).
 */
const literaryUseShape = {
  text: EntryTextSchema,
  author: EntryTextSchema,
  work: EntryTextSchema,
  /** The year the author died, from which the build counts the public domain. */
  authorDeathYear: z.int(),
  /** The year the work was written or first published. */
  workYear: z.int().optional(),
  /** Where the text can be read. */
  url: WebAddressSchema.optional(),
};

export const LiteraryUseSchema = z.strictObject(literaryUseShape);

const LiteraryUseOutputSchema = z.object(literaryUseShape);

export type LiteraryUse = z.infer<typeof LiteraryUseSchema>;

// The fields of a Correction, with its nested schemas strict for content and open for outputs.
const correctionShape = (
  examplePair: typeof ExamplePairSchema | typeof ExamplePairOutputSchema,
  literaryUse: typeof LiteraryUseSchema | typeof LiteraryUseOutputSchema,
  source: typeof SourceSchema | typeof SourceOutputSchema,
) => ({
  kind: z.literal('correction').default('correction'),
  id: CorrectionIdSchema,
  nonStandardForm: EntryTextSchema,
  correctionType: CorrectionTypeSchema,
  // The array names the field when it is empty; the tuple with a rest it
  // pipes into types the main equivalent as always there.
  standardEquivalents: z
    .array(EntryTextSchema)
    .min(1)
    .pipe(z.tuple([EntryTextSchema], EntryTextSchema))
    .refine(hasNoRepeats, 'Standard equivalents must not repeat'),
  explanation: EntryTextSchema,
  examplePair,
  /** One of the Edition's Categories of Corrections, a list apart from the Words' (ADR 0033). */
  categoryId: z.string().min(1),
  sources: z.array(source).min(1),
  /** Real uses of the standard form in literature, in the order the card shows them. */
  literaryUses: z.array(literaryUse).max(3).default([]),
  retired: z.boolean().default(false),
});

/**
 * A Correction as authored in an Edition's content and as returned by the
 * Core: a non-standard form people commonly use, paired with its standard
 * equivalents (the main one first) and a short neutral explanation.
 *
 * `kind` tells Entries apart. Authored files may leave it out, because the
 * folder already says what they hold. `retired` defaults to false; a Retired
 * Correction stays reachable by id but is left out like a Retired Word.
 */
export const CorrectionSchema = z.strictObject(
  correctionShape(ExamplePairSchema, LiteraryUseSchema, SourceSchema),
);

/** A Correction as an output carries it: open to fields a later backend adds (ADR 0031). */
export const CorrectionOutputSchema = z.object(
  correctionShape(ExamplePairOutputSchema, LiteraryUseOutputSchema, SourceOutputSchema),
);

/** A Correction with every default filled in, as the Core returns it. */
export type Correction = z.output<typeof CorrectionSchema>;

/** A Correction as authored, where defaulted fields may be left out. */
export type CorrectionInput = z.input<typeof CorrectionSchema>;
