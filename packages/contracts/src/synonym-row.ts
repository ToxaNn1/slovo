import { z } from 'zod';

import { SourceSchema, TextSchema } from './shared';
import { ExampleSchema, WordIdSchema } from './word';

/**
 * A Synonym Row id: opaque, assigned when the row is authored and never
 * reused. The `r_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const SynonymRowIdSchema = z
  .string()
  .regex(/^r_[a-z0-9]+$/, 'Expected a Synonym Row id: r_ followed by lowercase letters and digits');

/** The most a member's shade note may say (ADR 0051). */
export const SHADE_NOTE_MAX_LENGTH = 60;

/**
 * A word of a Synonym Row as it is shown: its text in Unicode NFC and its
 * Stress, the zero-based positions of its stressed vowels within the text's
 * characters, in ascending order, as a Word's Stress counts them. No word of a
 * row goes without Stress. `wordId` links the Word of the Language Pack it
 * is, if any.
 */
const RowWordShape = {
  text: TextSchema.refine(
    (text) => text === text.normalize('NFC'),
    'Expected the text in Unicode NFC, with every letter composed',
  ),
  stress: z
    .array(z.int().nonnegative())
    .min(1)
    .refine(
      (positions) => positions.every((position, i) => position > (positions[i - 1] ?? -1)),
      'Expected Stress positions in ascending order without repeats',
    ),
  wordId: WordIdSchema.optional(),
};

/** The dominant of a Synonym Row: the word the row gives synonyms for. */
export const SynonymRowDominantSchema = z.strictObject(RowWordShape);

export type SynonymRowDominant = z.infer<typeof SynonymRowDominantSchema>;

/** A member of a Synonym Row, with an optional note on its shade («повільно»). */
export const SynonymRowMemberSchema = z.strictObject({
  ...RowWordShape,
  shadeNote: TextSchema.max(SHADE_NOTE_MAX_LENGTH).optional(),
});

export type SynonymRowMember = z.infer<typeof SynonymRowMemberSchema>;

/**
 * A Synonym Row as authored in an Edition's content and as returned by the
 * Core: a dominant, a short meaning line that says the sense of the dominant
 * the row is about, and 5 to 12 members in the order the card shows them. It
 * has no Category, rarity or Pronunciation (ADR 0051).
 *
 * `kind` tells Entries apart. Authored files may leave it out, because the
 * folder already says what they hold. `retired` defaults to false; a Retired
 * Synonym Row stays reachable by id but is left out like a Retired Word.
 */
export const SynonymRowSchema = z.strictObject({
  kind: z.literal('synonymRow').default('synonymRow'),
  id: SynonymRowIdSchema,
  dominant: SynonymRowDominantSchema,
  meaning: TextSchema,
  members: z.array(SynonymRowMemberSchema).min(5).max(12),
  example: ExampleSchema.optional(),
  sources: z.array(SourceSchema).min(1),
  retired: z.boolean().default(false),
});

/** A Synonym Row with every default filled in, as the Core returns it. */
export type SynonymRow = z.output<typeof SynonymRowSchema>;

/** A Synonym Row as authored, where defaulted fields may be left out. */
export type SynonymRowInput = z.input<typeof SynonymRowSchema>;
