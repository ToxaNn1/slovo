import { z } from 'zod';

/**
 * Language-agnostic part-of-speech codes. Editions supply the display labels.
 */
export const PartOfSpeechSchema = z.enum([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'numeral',
  'preposition',
  'conjunction',
  'particle',
  'interjection',
]);

export type PartOfSpeech = z.infer<typeof PartOfSpeechSchema>;

/** Language-agnostic grammatical gender codes, carried by nouns only. */
export const GenderSchema = z.enum(['masculine', 'feminine', 'neuter', 'common']);

export type Gender = z.infer<typeof GenderSchema>;

/** Register labels a dictionary puts on a Word. */
export const RegisterSchema = z.enum(['archaic', 'dialectal', 'bookish', 'colloquial']);

export type Register = z.infer<typeof RegisterSchema>;

/**
 * A Word id: opaque, assigned when the Word is authored and never reused.
 * The `w_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const WordIdSchema = z
  .string()
  .regex(/^w_[a-z0-9]+$/, 'Expected a Word id: w_ followed by lowercase letters and digits');

const TextSchema = z.string().min(1);

const WebAddressSchema = z.url({ protocol: /^https?$/ });

/** A sentence showing the Word in use, with its author when the source names one. */
export const ExampleSchema = z.strictObject({
  text: TextSchema,
  author: TextSchema.optional(),
});

export type Example = z.infer<typeof ExampleSchema>;

/** Where content was taken from: a citation, its web address and an archived copy. */
export const SourceSchema = z.strictObject({
  title: TextSchema,
  url: WebAddressSchema.optional(),
  archivedUrl: WebAddressSchema.optional(),
});

export type Source = z.infer<typeof SourceSchema>;

/** From 1 ("heard it, never use it") to 5 ("almost nobody knows it"). */
export const RaritySchema = z.int().min(1).max(5);

const hasNoRepeats = (items: readonly unknown[]) => new Set(items).size === items.length;

/**
 * A Word as authored in an Edition's content and as returned by the Core.
 *
 * Stress lists the zero-based positions of the stressed vowels within the
 * Lemma's characters, in ascending order; a Lemma may have more than one
 * valid Stress. It stays empty in Editions that don't mark Stress.
 *
 * List fields default to empty and `retired` to false, so authored content
 * only spells out what the sources provide.
 */
export const WordSchema = z
  .strictObject({
    id: WordIdSchema,
    lemma: TextSchema,
    stress: z
      .array(z.int().nonnegative())
      .refine(
        (positions) => positions.every((position, i) => position > (positions[i - 1] ?? -1)),
        'Expected Stress positions in ascending order without repeats',
      )
      .default([]),
    partOfSpeech: PartOfSpeechSchema,
    gender: GenderSchema.optional(),
    primaryDefinition: TextSchema,
    extraDefinitions: z.array(TextSchema).default([]),
    examples: z.array(ExampleSchema).default([]),
    synonyms: z.array(TextSchema).default([]),
    antonyms: z.array(TextSchema).default([]),
    etymology: TextSchema.optional(),
    registers: z
      .array(RegisterSchema)
      .refine(hasNoRepeats, 'Register labels must not repeat')
      .default([]),
    categoryId: z.string().min(1),
    rarity: RaritySchema,
    sources: z.array(SourceSchema).min(1),
    retired: z.boolean().default(false),
  })
  .superRefine((word, context) => {
    if (word.partOfSpeech === 'noun' && word.gender === undefined) {
      context.addIssue({ code: 'custom', path: ['gender'], message: 'Required for a noun' });
    }
    if (word.partOfSpeech !== 'noun' && word.gender !== undefined) {
      context.addIssue({ code: 'custom', path: ['gender'], message: 'Only nouns carry a gender' });
    }
  });

/** A Word with every default filled in, as the Core returns it. */
export type Word = z.output<typeof WordSchema>;

/** A Word as authored, where defaulted fields may be left out. */
export type WordInput = z.input<typeof WordSchema>;
