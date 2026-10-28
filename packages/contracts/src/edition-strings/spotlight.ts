import { z } from 'zod';

import { pluralOf } from './shared';

/** The texts of the Spotlight Snapshot that the Core writes itself (ADR 0057). */
export const SpotlightStringsSchema = z.strictObject({
  /** A Collection's second line, by its Entries, `{count}`, e.g. «Колекція · 12 слів». */
  collection: pluralOf(),
});
