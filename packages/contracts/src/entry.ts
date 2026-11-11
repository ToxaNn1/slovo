import { z } from 'zod';

import { CorrectionIdSchema, CorrectionSchema } from './correction';
import { IdiomIdSchema, IdiomSchema } from './idiom';
import { SynonymRowIdSchema, SynonymRowSchema } from './synonym-row';
import { TipIdSchema, TipSchema } from './tip';
import { WordIdSchema, WordSchema } from './word';

/**
 * Anything the user can discover, keep and share: a Word, a Correction, an
 * Idiom, a Synonym Row or a Tip, told apart by `kind`. Unlike the authored files, an Entry on its own
 * must spell its `kind` out.
 */
export const EntrySchema = z.discriminatedUnion('kind', [
  WordSchema,
  CorrectionSchema,
  IdiomSchema,
  SynonymRowSchema,
  TipSchema,
]);

export type Entry = z.output<typeof EntrySchema>;

export type EntryKind = Entry['kind'];

/**
 * A kind of Entry that is in or out of the Mix as a whole: every kind but the
 * Word, whose Categories are in or out one by one (ADR 0019, 0051).
 */
export type MixKind = Exclude<EntryKind, 'word'>;

/** A kind of Entry in the Mix as a whole: every kind `EntrySchema` tells apart but the Word. */
export const MixKindSchema = z.literal(
  EntrySchema.options
    .map((entry) => entry.shape.kind.unwrap().value)
    .filter((kind) => kind !== 'word'),
);

/** The id of an Entry of any of the five kinds, told apart by its prefix. */
export const EntryIdSchema = z.union([
  WordIdSchema,
  CorrectionIdSchema,
  IdiomIdSchema,
  SynonymRowIdSchema,
  TipIdSchema,
]);
