import { z } from 'zod';

import type { BuildError } from './build-error';

export const MANIFEST_FILE = 'content/manifest.json';

/**
 * Describes the content as a whole. The content version grows with every
 * change to the content, and the checksum recorded with it is the checksum
 * of the pack built at that version, so a change that leaves the version
 * behind fails the build.
 */
export const ContentManifestSchema = z.strictObject({
  contentVersion: z.int().positive(),
  checksum: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/, 'Expected sha256: followed by 64 hex digits')
    .optional(),
});

export type ContentManifest = z.infer<typeof ContentManifestSchema>;

/** Whether the manifest records the content as it is, given its checksum at the manifest's version. */
export function unrecordedContentErrors(
  manifest: ContentManifest,
  checksum: string,
  editionId: string,
): BuildError[] {
  if (manifest.checksum === checksum) return [];
  const version = String(manifest.contentVersion);
  const command = `pnpm build:pack ${editionId} --record`;
  return [
    {
      file: MANIFEST_FILE,
      field: 'checksum',
      message:
        manifest.checksum === undefined
          ? `Not recorded for content version ${version}: record it with ${command}`
          : `The content changed since content version ${version}: raise the version and record its checksum with ${command}`,
    },
  ];
}
