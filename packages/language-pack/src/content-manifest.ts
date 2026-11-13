import { checksumOf } from '@slovo/content-rules';
import { PackMetadataSchema, type PackMetadata } from '@slovo/contracts';
import { z } from 'zod';

import type { BuildError } from './build-error';
import type { PackContent } from './pack-layout';

export const MANIFEST_FILE = 'content/manifest.json';

/**
 * Describes the content as a whole. The content version grows with every
 * change to the content, and the checksum recorded with it is the checksum
 * of the pack built at that version, so a change that leaves the version
 * behind fails the build (ADR 0011).
 */
export const ContentManifestSchema = z.strictObject({
  contentVersion: PackMetadataSchema.shape.contentVersion,
  contentChecksum: PackMetadataSchema.shape.contentChecksum.optional(),
  /** The checksum of the crossword days as last recorded, the days published (ADR 0052). */
  crosswordDaysChecksum: PackMetadataSchema.shape.contentChecksum.optional(),
});

export type ContentManifest = z.infer<typeof ContentManifestSchema>;

/** A manifest that records content: its version and the checksum of the pack built at it. */
export type RecordedManifest = Pick<PackMetadata, 'contentVersion'> & {
  readonly contentChecksum: string;
};

/** Whether the manifest records the content as it is. */
export type ContentVersionCheck =
  | { readonly recorded: true; readonly manifest: RecordedManifest }
  | {
      readonly recorded: false;
      /** The manifest that records the content: the next version and the checksum at it. */
      readonly next: RecordedManifest;
      /** Why the content does not build until `next` is recorded. */
      readonly error: BuildError;
    };

/**
 * The rule of ADR 0011: content builds only at the version its manifest
 * records with the content's checksum. The checksum covers the version, so a
 * checksum copied without raising the version is not recorded either.
 * `content` carries the version of `manifest`.
 */
export function checkContentVersion(
  content: PackContent,
  manifest: ContentManifest,
): ContentVersionCheck {
  const contentChecksum = checksumOf(content);
  if (manifest.contentChecksum === contentChecksum) {
    return {
      recorded: true,
      manifest: { contentVersion: content.contentVersion, contentChecksum },
    };
  }
  const nextVersion = manifest.contentVersion + 1;
  const version = String(manifest.contentVersion);
  const command = `pnpm build:pack ${content.editionId} --record`;
  return {
    recorded: false,
    next: {
      contentVersion: nextVersion,
      contentChecksum: checksumOf({ ...content, contentVersion: nextVersion }),
    },
    error: {
      file: MANIFEST_FILE,
      field: 'contentChecksum',
      message:
        manifest.contentChecksum === undefined
          ? `Not recorded for content version ${version}: record it with ${command}`
          : `The content changed since content version ${version}: raise the version and record its checksum with ${command}`,
    },
  };
}
