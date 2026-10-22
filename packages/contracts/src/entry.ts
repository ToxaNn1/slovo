import { z } from 'zod';

import { CorrectionSchema } from './correction';
import { IdiomSchema } from './idiom';
import { WordSchema } from './word';

/**
 * Anything the user can discover, keep and share: a Word, a Correction or an
 * Idiom, told apart by `kind`. Unlike the authored files, an Entry on its own
 * must spell its `kind` out.
 */
export const EntrySchema = z.discriminatedUnion('kind', [
  WordSchema,
  CorrectionSchema,
  IdiomSchema,
]);

export type Entry = z.output<typeof EntrySchema>;

export type EntryKind = Entry['kind'];
