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

/** The id of an Entry of any of the five kinds, told apart by its prefix. */
export const EntryIdSchema = z.union([
  WordIdSchema,
  CorrectionIdSchema,
  IdiomIdSchema,
  SynonymRowIdSchema,
  TipIdSchema,
]);
