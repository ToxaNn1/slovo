import { z } from 'zod';

import { CorrectionSchema } from './correction';
import { WordSchema } from './word';

/**
 * Anything the user can discover, keep and share: a Word or a Correction,
 * told apart by `kind`. Unlike the authored files, an Entry on its own must
 * spell its `kind` out.
 */
export const EntrySchema = z.discriminatedUnion('kind', [WordSchema, CorrectionSchema]);

export type Entry = z.output<typeof EntrySchema>;

export type EntryKind = Entry['kind'];
