import { z } from 'zod';

import { SourceSchema, TextSchema } from './shared';
import { ExampleSchema } from './word';

/**
 * An Idiom id: opaque, assigned when the Idiom is authored and never reused.
 * The `i_` prefix keeps it apart from the ids of other kinds of Entry.
 */
export const IdiomIdSchema = z
  .string()
  .regex(/^i_[a-z0-9]+$/, 'Expected an Idiom id: i_ followed by lowercase letters and digits');

/**
 * What kind of fixed expression an Idiom is: an idiom proper («фразеологізм»),
 * a place name («топонім»), whose story is its etymology, or a proverb
 * («прислів’я») (ADR 0046). The Edition strings name each type.
 */
export const IdiomTypeSchema = z.enum(['idiom', 'placeName', 'proverb']);

export type IdiomType = z.infer<typeof IdiomTypeSchema>;

/**
 * An Idiom as authored in an Edition's content and as returned by the Core:
 * a fixed expression whose meaning is not the sum of its words, with its
 * Definitions, Examples and, where known, its origin. It has no Lemma,
 * Stress, part of speech, Category, rarity or Pronunciation (ADR 0046).
 *
 * The expression is in Unicode NFC; which letters it may hold depends on the
 * Edition, so the Language Pack build checks them. A place name requires its
 * etymology.
 *
 * `kind` tells Entries apart. Authored files may leave it out, because the
 * folder already says what they hold. List fields default to empty and
 * `retired` to false; a Retired Idiom stays reachable by id but is left out
 * like a Retired Word.
 */
export const IdiomSchema = z
  .strictObject({
    kind: z.literal('idiom').default('idiom'),
    id: IdiomIdSchema,
    expression: TextSchema.refine(
      (expression) => expression === expression.normalize('NFC'),
      'Expected the expression in Unicode NFC, with every letter composed',
    ),
    idiomType: IdiomTypeSchema,
    primaryDefinition: TextSchema,
    extraDefinitions: z.array(TextSchema).default([]),
    examples: z.array(ExampleSchema).default([]),
    etymology: TextSchema.optional(),
    sources: z.array(SourceSchema).min(1),
    retired: z.boolean().default(false),
  })
  .superRefine((idiom, context) => {
    if (idiom.idiomType === 'placeName' && idiom.etymology === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['etymology'],
        message: 'Required for a place name: its etymology tells the story of its name',
      });
    }
  });

/** An Idiom with every default filled in, as the Core returns it. */
export type Idiom = z.output<typeof IdiomSchema>;

/** An Idiom as authored, where defaulted fields may be left out. */
export type IdiomInput = z.input<typeof IdiomSchema>;
