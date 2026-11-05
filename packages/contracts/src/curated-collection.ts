import { z } from 'zod';

import { EntryIdSchema } from './entry';
import { TextSchema, hasNoRepeats } from './shared';

/**
 * A Curated Collection id: opaque, assigned when the collection is authored
 * and never reused. The `cc_` prefix keeps it apart from Entry ids.
 */
export const CuratedCollectionIdSchema = z
  .string()
  .regex(
    /^cc_[a-z0-9]+$/,
    'Expected a Curated Collection id: cc_ followed by lowercase letters and digits',
  );

/**
 * A Curated Collection as the Language Pack holds it (ADR 0076): an editorial
 * set of Entries with a name, a description and the local date from which the
 * Dashboard's «Добірки» rail shows it.
 */
export const CuratedCollectionSchema = z.strictObject({
  id: CuratedCollectionIdSchema,
  name: TextSchema,
  description: TextSchema,
  /** The local date (`YYYY-MM-DD`) from which the collection is on the rail. */
  publishedOn: z.iso.date(),
  /** The Entries in the collection's order. */
  entryIds: z.array(EntryIdSchema).min(1).refine(hasNoRepeats, 'Expected each Entry at most once'),
});

export type CuratedCollection = z.output<typeof CuratedCollectionSchema>;
