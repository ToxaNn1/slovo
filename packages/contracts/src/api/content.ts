import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { PublishedPackSchema } from '../language-pack';
import { procedure } from './procedure';

/**
 * What a published pack file answers besides its bytes: a published content
 * version never changes (ADR 0032), so a client or a proxy may keep the file
 * for good, and the ETag, the file's SHA-256 in quotes, names it.
 */
const PackFileCachingSchema = z.object({
  etag: z.string(),
  'cache-control': z.string(),
});

/** The media type of a Language Pack file: a SQLite database. */
export const PACK_MEDIA_TYPE = 'application/vnd.sqlite3';

/** The content procedures of an Edition. They need no Account. */
export const contentContract = {
  latest: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/content/latest',
      summary: 'The newest published Language Pack the app can read',
      tags: ['content'],
    })
    // An Edition the backend doesn't serve, or one with content updates off.
    .errors({ NOT_FOUND: { message: 'Not found' } })
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

  download: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/content/packs/{contentVersion}',
      summary: 'The file of a published Language Pack',
      tags: ['content'],
      inputStructure: 'detailed',
      outputStructure: 'detailed',
    })
    // An Edition the backend doesn't serve, one with content updates off, or
    // a content version not published.
    .errors({ NOT_FOUND: { message: 'Not found' } })
    .input(
      z.object({
        params: z.strictObject({
          editionId: EditionIdSchema,
          // The database keeps a content version in 32 bits.
          contentVersion: z.coerce
            .number<number>()
            .int()
            .positive()
            .max(2 ** 31 - 1),
        }),
        // No query field: an unknown one is refused (ADR 0031).
        query: z.strictObject({}).optional(),
        headers: z
          .object({
            /** The ETag of a file the client keeps; 304 when it names this one. */
            'if-none-match': z.string().optional(),
          })
          .optional(),
      }),
    )
    .output(
      z.union([
        z.object({
          status: z.literal(200),
          headers: PackFileCachingSchema,
          /** The pack file, whose SHA-256 `content.latest` announces. */
          body: z.file().mime(PACK_MEDIA_TYPE),
        }),
        z.object({
          status: z.literal(304).describe('The file the client keeps is this one'),
          headers: PackFileCachingSchema,
        }),
      ]),
    ),
};
