import { z } from 'zod';

import { TextSchema } from '../shared';

/** The texts of Knowledge Marks: the two buttons of an Entry card's action row and the Review label. */
export const KnowledgeStringsSchema = z.strictObject({
  /** The button that marks the Entry Known. */
  known: TextSchema,
  /** What the Known button means on a Correction, for a screen reader. */
  correctionKnownHint: TextSchema,
  /** The button that marks the Entry Unknown. */
  unknown: TextSchema,
  /** The label on a card the Feed brought back for Review. */
  review: TextSchema,
});
