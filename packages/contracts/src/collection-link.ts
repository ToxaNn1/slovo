import { z } from 'zod';

import { EditionIdSchema } from './edition';
import { EntryIdSchema } from './entry';
import { hasNoRepeats } from './shared';

/** How many characters a shared Collection's name has at most, trimmed. */
export const COLLECTION_LINK_NAME_LENGTH = 60;

/** How many Entries a Collection Link holds at most. */
export const COLLECTION_LINK_SIZE = 200;

/** A Collection Link's id: 10 random letters and digits, the `<id>` of `c/<id>` (ADR 0058). */
export const CollectionLinkIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{10}$/, 'Expected a Collection Link id: 10 letters and digits');

/**
 * A Collection as a Collection Link holds it (ADR 0058): its Edition, its name
 * and its Entry ids in the Collection's order, as it was when it was shared.
 * It carries no Account and no device id: the body has no field for either.
 */
export const CollectionLinkSchema = z.strictObject({
  edition: EditionIdSchema,
  /** The Collection's name, trimmed. */
  name: z.string().trim().min(1).max(COLLECTION_LINK_NAME_LENGTH),
  entryIds: z
    .array(EntryIdSchema)
    .min(1)
    .max(COLLECTION_LINK_SIZE)
    .refine(hasNoRepeats, 'Expected each Entry at most once'),
});

export type CollectionLink = z.output<typeof CollectionLinkSchema>;
