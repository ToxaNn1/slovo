import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, templateOf } from './shared';

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
  /** The Community Counters line under the mark buttons, e.g. «Знають 3 з 5 читачів · зберегли 0». */
  communityCounters: z.strictObject({
    /** Who know the Entry, by the readers who marked it, `{count}`; takes `{known}`. */
    known: pluralOf('known'),
    /** Who saved the Entry. Takes `{saved}`. */
    saved: templateOf('saved'),
    /** How the two join, e.g. "{known} · {saved}". */
    line: templateOf('known', 'saved'),
  }),
});
