import { z } from 'zod';

import { CorrectionIdSchema } from './correction';
import { hasNoRepeats, SourceSchema, TextSchema } from './shared';

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

/**
 * Language-agnostic grammatical gender codes, carried by nouns only.
 * `plural-only` marks pluralia tantum: nouns with only a plural form, and so
 * no gender of their own.
 */
export const GenderSchema = z.enum(['masculine', 'feminine', 'neuter', 'common', 'plural-only']);

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

/** A sentence showing the Word in use, with its author when the source names one. */
export const ExampleSchema = z.strictObject({
  text: TextSchema,
  author: TextSchema.optional(),
});

export type Example = z.infer<typeof ExampleSchema>;

/** From 1 ("heard it, never use it") to 5 ("almost nobody knows it"). */
export const RaritySchema = z.int().min(1).max(5);

/**
 * A Word as authored in an Edition's content and as returned by the Core.
 *
 * The Lemma is in Unicode NFC; which letters it may hold depends on the
 * Edition, so the Language Pack build checks them.
 *
 * Stress lists the zero-based positions of the stressed vowels within the
 * Lemma's characters, in ascending order; a Lemma may have more than one
 * valid Stress. It stays empty in Editions that don't mark Stress.
 *
 * `correctionIds` links the Corrections the Word is the standard form for.
 *
 * List fields default to empty and `retired` to false, so authored content
 * only spells out what the sources provide. `kind` tells Entries apart;
 * authored files may leave it out, because the folder already says what they
 * hold.
 */
export const WordSchema = z
  .strictObject({
    kind: z.literal('word').default('word'),
    id: WordIdSchema,
    lemma: TextSchema.refine(
      (lemma) => lemma === lemma.normalize('NFC'),
      'Expected the Lemma in Unicode NFC, with every letter composed',
    ),
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
    correctionIds: z
      .array(CorrectionIdSchema)
      .refine(hasNoRepeats, 'Linked Correction ids must not repeat')
      .default([]),
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
