import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { PackMetadataSchema } from '../language-pack';
import { procedure } from './procedure';

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

/** The content procedures of an Edition. They need no Account. */
export const contentContract = {
  latest: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/content/latest',
      summary: 'The newest published Language Pack the app can read',
      tags: ['content'],
    })
    .errors({ NOT_FOUND: { message: 'No such Edition' } })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        /** The highest pack format the app reads. */
        packFormat: z.coerce.number<number>().int().positive(),
      }),
    )
    .output(
      z.object({
        /** None when nothing of the pack format is published. */
        pack: PublishedPackSchema.nullable(),
      }),
    ),
};
