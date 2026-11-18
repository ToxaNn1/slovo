import { z } from 'zod';

import { EntryIdSchema } from './entry';
import { EntryTextSchema, hasNoRepeats, KebabCaseIdSchema, recordIdSchema } from './shared';

/**
 * A Curated Collection id: opaque, assigned when the collection is authored
 * and never reused. The `cc_` prefix keeps it apart from Entry ids.
 */
export const CuratedCollectionIdSchema = recordIdSchema(
  'curatedCollection',
  'a Curated Collection',
);

const curatedCollectionShape = {
  id: CuratedCollectionIdSchema,
  name: EntryTextSchema,
  description: EntryTextSchema,
  /** The local date (`YYYY-MM-DD`) from which the collection is on the rail. */
  publishedOn: z.iso.date(),
  /** The Entries in the collection's order. */
  entryIds: z.array(EntryIdSchema).min(1).refine(hasNoRepeats, 'Expected each Entry at most once'),
  /**
   * The id of the Category or Correction Category whose pictogram the
   * collection's tile draws (ADR 0178); unset, the Edition's
   * `curatedCollectionPictogram`. The Language Pack build refuses an id that
   * names no Category.
   */
  pictogram: KebabCaseIdSchema.optional(),
  /**
   * A Retired collection has left circulation (ADR 0178): no rail, grid,
   * screen or Feed shows it, and the Language Pack holds no rows of it. A
   * reader's copy among their Collections stays. Defaults to false.
   */
  retired: z.boolean().default(false),
};

/**
 * A Curated Collection as the Language Pack holds it (ADR 0076): an editorial
 * set of Entries with a name, a description and the local date from which the
 * Dashboard's «SLOVO пропонує» rail shows it, and the Category whose pictogram its tile draws (ADR 0178).
 */
export const CuratedCollectionSchema = z.strictObject(curatedCollectionShape);

/** A Curated Collection as an output carries it: open to fields a later backend adds (ADR 0031). */
export const CuratedCollectionOutputSchema = z.object(curatedCollectionShape);

export type CuratedCollection = z.output<typeof CuratedCollectionSchema>;
