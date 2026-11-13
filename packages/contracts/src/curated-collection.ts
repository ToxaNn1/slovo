import { z } from 'zod';

import { EntryIdSchema } from './entry';
import { EntryTextSchema, hasNoRepeats } from './shared';

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

const curatedCollectionShape = {
  id: CuratedCollectionIdSchema,
  name: EntryTextSchema,
  description: EntryTextSchema,
  /** The local date (`YYYY-MM-DD`) from which the collection is on the rail. */
  publishedOn: z.iso.date(),
  /** The Entries in the collection's order. */
  entryIds: z.array(EntryIdSchema).min(1).refine(hasNoRepeats, 'Expected each Entry at most once'),
};

/**
 * A Curated Collection as the Language Pack holds it (ADR 0076): an editorial
 * set of Entries with a name, a description and the local date from which the
 * Dashboard's «Добірки» rail shows it.
 */
export const CuratedCollectionSchema = z.strictObject(curatedCollectionShape);

/** A Curated Collection as an output carries it: open to fields a later backend adds (ADR 0031). */
export const CuratedCollectionOutputSchema = z.object(curatedCollectionShape);

export type CuratedCollection = z.output<typeof CuratedCollectionSchema>;
