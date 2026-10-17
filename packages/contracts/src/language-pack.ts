import { z } from 'zod';

import { EditionIdSchema } from './edition';

/**
 * The checksum of a Language Pack's content: `sha256:` followed by the hex
 * digest of the canonical content, version included (ADR 0011). It is not
 * the SHA-256 of the pack file.
 */
const ContentChecksumSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, 'Expected sha256: followed by 64 hex digits');

/** What identifies a compiled Language Pack, recorded in the pack itself. */
export const PackMetadataSchema = z.strictObject({
  editionId: EditionIdSchema,
  contentVersion: z.int().positive(),
  contentChecksum: ContentChecksumSchema,
});

export type PackMetadata = z.infer<typeof PackMetadataSchema>;
