import { z } from 'zod';

import { CorrectionSchema } from '../correction';
import { CrosswordDaySchema } from '../crossword';
import { CuratedCollectionSchema } from '../curated-collection';
import { EditionIdSchema } from '../edition';
import { IdiomSchema } from '../idiom';
import { SynonymRowSchema } from '../synonym-row';
import { TipSchema } from '../tip';
import { WordIdSchema, WordSchema } from '../word';
import { PublishedPackSchema } from '../language-pack';
import { procedure } from './procedure';

/** The Patch format the backend writes; an app refuses a newer one and keeps its content (ADR 0090). */
export const PATCH_FORMAT = 1;

/** The seven kinds of content records, each in id order, the Retired ones included (ADR 0090). */
const contentKinds = {
  words: z.array(WordSchema),
  idioms: z.array(IdiomSchema),
  corrections: z.array(CorrectionSchema),
  tips: z.array(TipSchema),
  synonymRows: z.array(SynonymRowSchema),
  curatedCollections: z.array(CuratedCollectionSchema),
  /** In date order. */
  crosswordDays: z.array(CrosswordDaySchema),
};

/** The whole content of an Edition at its current content version, as the backend serves it. */
export const ContentSnapshotSchema = z.object({
  editionId: EditionIdSchema,
  /** The Edition's content version; every record below is as of it. */
  contentVersion: z.number().int().positive(),
  ...contentKinds,
  /** The ids of the Words whose text changed since their Recordings, in id order. */
  needsNewRecording: z.array(WordIdSchema),
});

export type ContentSnapshot = z.infer<typeof ContentSnapshotSchema>;

/**
 * A Patch: the whole current record of every kind changed after the content
 * version the device holds, the Retired ones with their flag, and the content
 * version it brings the device to.
 */
export const PatchSchema = z.object({
  editionId: EditionIdSchema,
  /** The content version the device held. */
  since: z.number().int().nonnegative(),
  /** The content version the device holds once it applies the Patch. */
  contentVersion: z.number().int().positive(),
  patchFormat: z.number().int().positive(),
  ...contentKinds,
});

export type Patch = z.infer<typeof PatchSchema>;

/** How a client or a proxy keeps a Patch: always revalidated, by its ETag. */
const PatchCachingSchema = z.object({
  etag: z.string(),
  'cache-control': z.string(),
});

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

  patch: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/content/patch',
      summary: 'Every record changed after the content version the device holds',
      tags: ['content'],
      inputStructure: 'detailed',
      outputStructure: 'detailed',
    })
    // An Edition the backend doesn't serve, one with content updates off, or
    // one whose content is not imported yet.
    .errors({ NOT_FOUND: { message: 'Not found' } })
    .input(
      z.object({
        params: z.strictObject({ editionId: EditionIdSchema }),
        query: z.strictObject({
          /** The content version the device holds; 0 gets every record. */
          since: z.coerce
            .number<number>()
            .int()
            .nonnegative()
            .max(2 ** 31 - 1),
          /** The highest Patch format the app reads. */
          patchFormat: z.coerce.number<number>().int().positive(),
        }),
        headers: z
          .object({
            /** The ETag of the Patch the device applied last; 304 when it names this one. */
            'if-none-match': z.string().optional(),
          })
          .optional(),
      }),
    )
    .output(
      z.union([
        z.object({
          status: z.literal(200),
          headers: PatchCachingSchema,
          body: z.discriminatedUnion('status', [
            z.object({ status: z.literal('patch'), patch: PatchSchema }),
            z.object({
              /** The backend does not serve the Patch format asked for; the app keeps its content. */
              status: z.literal('unsupported-format'),
              /** The Patch format the backend serves. */
              patchFormat: z.number().int().positive(),
            }),
          ]),
        }),
        z.object({
          status: z.literal(304).describe('The device already holds the current content version'),
          headers: PatchCachingSchema,
        }),
      ]),
    ),

  snapshot: procedure
    .route({
      method: 'GET',
      path: '/editions/{editionId}/content/snapshot',
      summary: 'The whole content of an Edition at its current content version',
      tags: ['content'],
    })
    // An Edition the backend doesn't serve, or one whose content is not imported yet.
    .errors({ NOT_FOUND: { message: 'Not found' } })
    .input(z.strictObject({ editionId: EditionIdSchema }))
    .output(ContentSnapshotSchema),
};
