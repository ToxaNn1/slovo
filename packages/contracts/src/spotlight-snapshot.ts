import { z } from 'zod';

import { hasNoRepeats, TextSchema } from './shared';
import { WidgetEntrySchema } from './widget-snapshot';

/**
 * An Entry as the iPhone search finds it: the text the widget shows for it
 * (ADR 0026) and the route a tap opens, `entry/<id>`.
 */
const SpotlightEntrySchema = z
  .strictObject({
    entry: WidgetEntrySchema,
    route: z.string().startsWith('entry/'),
  })
  .refine(({ entry, route }) => route === `entry/${entry.id}`, 'Expected the route of the Entry');

/**
 * A Collection as the iPhone search finds it: by its name, with its count of
 * Entries in the Edition's plural forms, and the route a tap opens,
 * `saved/collections/<id>`.
 */
const SpotlightCollectionSchema = z
  .strictObject({
    id: z.string().min(1),
    /** The name the user gave it. */
    name: TextSchema,
    /** «Колекція · 12 слів». */
    secondLine: TextSchema,
    route: z.string().startsWith('saved/collections/'),
  })
  .refine(
    ({ id, route }) => route === `saved/collections/${id}`,
    'Expected the route of the Collection',
  );

/**
 * The Spotlight Snapshot (ADR 0057): everything the iPhone search may find,
 * decided by the Core, which the app hands to its native module to replace
 * the whole index with. Empty, the index is emptied.
 */
export const SpotlightSnapshotSchema = z
  .strictObject({
    /** The Entries in Favorites, any Collection or the Word of the Day archive, each once. */
    entries: z.array(SpotlightEntrySchema),
    /** Every Collection, empty ones too. */
    collections: z.array(SpotlightCollectionSchema),
  })
  .refine(
    ({ entries }) => hasNoRepeats(entries.map(({ entry }) => entry.id)),
    'Expected each Entry once',
  )
  .refine(
    ({ collections }) => hasNoRepeats(collections.map(({ id }) => id)),
    'Expected each Collection once',
  );

export type SpotlightSnapshot = z.output<typeof SpotlightSnapshotSchema>;
