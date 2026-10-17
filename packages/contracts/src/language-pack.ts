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

/**
 * What identifies a compiled Language Pack, recorded in the pack itself. The
 * pack format says which layout the pack has; content updates send a pack
 * only to an app that reads its format (0.7).
 */
export const PackMetadataSchema = z.strictObject({
  editionId: EditionIdSchema,
  contentVersion: z.int().positive(),
  contentChecksum: ContentChecksumSchema,
  packFormat: z.int().positive(),
});

export type PackMetadata = z.infer<typeof PackMetadataSchema>;

/** The newest published Language Pack of a pack format, as the backend announces it. */
export const PublishedPackSchema = z.object({
  contentVersion: PackMetadataSchema.shape.contentVersion,
  packFormat: PackMetadataSchema.shape.packFormat,
  /** The size of the pack file, in bytes. */
  size: z.int().positive(),
  /** The SHA-256 of the pack file, as 64 lowercase hex digits; not the content checksum. */
  fileSha256: z.string().regex(/^[0-9a-f]{64}$/, 'Expected 64 lowercase hex digits'),
});

export type PublishedPack = z.infer<typeof PublishedPackSchema>;
