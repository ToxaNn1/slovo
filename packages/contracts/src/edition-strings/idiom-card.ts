import { z } from 'zod';

import { IdiomTypeSchema } from '../idiom';
import { TextSchema } from '../shared';

export const IdiomCardStringsSchema = z.strictObject({
  /** The name of every Idiom Type, e.g. "фразеологізм", "топонім". */
  idiomTypes: z.record(IdiomTypeSchema, TextSchema),
  /** The heading over an Idiom's etymology, e.g. "Походження". */
  etymology: TextSchema,
});
