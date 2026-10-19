import { z } from 'zod';

import { TextSchema } from '../shared';

/** The texts of Knowledge Marks: the two buttons of an Entry card's action row. */
export const KnowledgeStringsSchema = z.strictObject({
  /** The button that marks the Entry Known. */
  known: TextSchema,
  /** The button that marks the Entry Unknown. */
  unknown: TextSchema,
});
