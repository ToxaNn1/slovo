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

/**
 * A Word as authored in an Edition's content and as returned by the Core.
 *
 * Stress lists the zero-based positions of the stressed vowels within the
 * Lemma's characters; a Lemma may have more than one valid Stress.
 */
export const WordSchema = z.strictObject({
  id: z.string().min(1),
  lemma: z.string().min(1),
  stress: z.array(z.int().nonnegative()),
  partOfSpeech: PartOfSpeechSchema,
  primaryDefinition: z.string().min(1),
  categoryId: z.string().min(1),
});

export type Word = z.infer<typeof WordSchema>;
