import { z } from 'zod';

import { SourceOutputSchema, SourceSchema, EntryTextSchema, recordIdSchema } from './shared';
import { ExampleOutputSchema, ExampleSchema, WordIdSchema } from './word';

/**
 * A Synonym Row id: opaque, assigned when the row is authored and never
 * reused. The `r_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const SynonymRowIdSchema = recordIdSchema('synonymRow', 'a Synonym Row');

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
  text: EntryTextSchema.refine(
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

const SynonymRowDominantOutputSchema = z.object(RowWordShape);

export type SynonymRowDominant = z.infer<typeof SynonymRowDominantSchema>;

/** A member of a Synonym Row, with an optional note on its shade («повільно»). */
const rowMemberShape = {
  ...RowWordShape,
  shadeNote: EntryTextSchema.max(SHADE_NOTE_MAX_LENGTH).optional(),
};

export const SynonymRowMemberSchema = z.strictObject(rowMemberShape);

const SynonymRowMemberOutputSchema = z.object(rowMemberShape);

export type SynonymRowMember = z.infer<typeof SynonymRowMemberSchema>;

// The fields of a Synonym Row, with its nested schemas strict for content and open for outputs.
const synonymRowShape = (
  dominant: typeof SynonymRowDominantSchema | typeof SynonymRowDominantOutputSchema,
  member: typeof SynonymRowMemberSchema | typeof SynonymRowMemberOutputSchema,
  example: typeof ExampleSchema | typeof ExampleOutputSchema,
  source: typeof SourceSchema | typeof SourceOutputSchema,
) => ({
  kind: z.literal('synonymRow').default('synonymRow'),
  id: SynonymRowIdSchema,
  dominant,
  meaning: EntryTextSchema,
  members: z.array(member).min(5).max(12),
  example: example.optional(),
  sources: z.array(source).min(1),
  retired: z.boolean().default(false),
});

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
export const SynonymRowSchema = z.strictObject(
  synonymRowShape(SynonymRowDominantSchema, SynonymRowMemberSchema, ExampleSchema, SourceSchema),
);

/** A Synonym Row as an output carries it: open to fields a later backend adds (ADR 0031). */
export const SynonymRowOutputSchema = z.object(
  synonymRowShape(
    SynonymRowDominantOutputSchema,
    SynonymRowMemberOutputSchema,
    ExampleOutputSchema,
    SourceOutputSchema,
  ),
);

/** A Synonym Row with every default filled in, as the Core returns it. */
export type SynonymRow = z.output<typeof SynonymRowSchema>;

/** A Synonym Row as authored, where defaulted fields may be left out. */
export type SynonymRowInput = z.input<typeof SynonymRowSchema>;
