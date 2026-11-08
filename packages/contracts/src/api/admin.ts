import { z } from 'zod';

import { ContentTargetsSchema } from '../content-targets';
import { CorrectionTypeSchema } from '../correction';
import { EditionIdSchema } from '../edition';
import { IdiomTypeSchema } from '../idiom';
import { procedure } from './procedure';

/** The kinds of record the content write API writes. */
export const ContentRecordKindSchema = z.enum([
  'word',
  'correction',
  'idiom',
  'synonymRow',
  'tip',
  'curatedCollection',
]);

/** What every content procedure can be refused with. */
const contentProcedure = procedure.errors({
  /** No Власник yet, an Edition the backend doesn't serve, or an unknown batch or record. */
  NOT_FOUND: { message: 'Not found' },
  /** No Агент token, an unknown or revoked one, or the app's Session. */
  UNAUTHORIZED: { message: 'Content is written by an Агент token or an admin session' },
  NOT_IMPORTED: { status: 409, message: "The Edition's content is not imported" },
});

/** What a write is refused with besides the common refusals. */
const writeErrors = {
  /** The save breaks the content rules: each refusal names its rule. */
  REFUSED: {
    status: 422,
    message: 'The record breaks a content rule',
    data: z.object({
      refusals: z.array(
        z.object({
          rule: z.string(),
          entryId: z.string().optional(),
          field: z.string().optional(),
          message: z.string(),
        }),
      ),
    }),
  },
  /** The record changed after the version the write saw. */
  STALE: {
    status: 409,
    message: 'The record changed since the version the write saw',
    data: z.object({ currentVersion: z.number().int().positive() }),
  },
} as const;

const recordPath = '/admin/content/{editionId}/records/{kind}';

/** What a write answers: the record's new version and the Edition's content version it published. */
const WrittenSchema = z.object({
  id: z.string(),
  recordVersion: z.number().int().positive(),
  contentVersion: z.number().int().positive(),
  batchId: z.string(),
  /** Words only: whether the Word's Recordings no longer read its text (ADR 0083). */
  needsNewRecording: z.boolean().optional(),
});

/** Every batch's writes name it: one CLI run, or one admin save. */
const BatchIdSchema = z.uuid();

/** The content report: counts of the live records per kind and Category. */
const ContentReportSchema = z.object({
  words: z.number().int(),
  retiredWords: z.number().int(),
  wordsPerCategory: z.array(
    z.object({ categoryId: z.string(), displayName: z.string(), words: z.number().int() }),
  ),
  rarity: z.array(z.object({ rarity: z.number().int(), words: z.number().int() })),
  coverage: z.object({
    examples: z.number().int(),
    synonyms: z.number().int(),
    etymology: z.number().int(),
    stress: z.number().int(),
    region: z.number().int(),
  }),
  corrections: z.number().int(),
  retiredCorrections: z.number().int(),
  correctionsPerType: z.array(
    z.object({ correctionType: CorrectionTypeSchema, corrections: z.number().int() }),
  ),
  correctionsPerCategory: z.array(
    z.object({ categoryId: z.string(), displayName: z.string(), corrections: z.number().int() }),
  ),
  idioms: z.number().int(),
  retiredIdioms: z.number().int(),
  idiomsPerType: z.array(z.object({ idiomType: IdiomTypeSchema, idioms: z.number().int() })),
});

/**
 * The content write API (ADR 0090): every write is checked by the shared
 * content rules and published at once as a new content version.
 */
const contentWriteContract = {
  openBatch: contentProcedure
    .route({
      method: 'POST',
      path: '/admin/content/{editionId}/batches',
      summary: 'Open a batch of content writes',
      description: 'A new batch is «не перевірено» until the Content queue reviews it.',
      tags: ['admin'],
    })
    .input(z.strictObject({ editionId: EditionIdSchema }))
    .output(z.object({ batchId: BatchIdSchema })),
  create: contentProcedure
    .route({
      method: 'POST',
      path: recordPath,
      summary: 'Create a record; the backend issues its id',
      tags: ['admin'],
    })
    .errors(writeErrors)
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        batchId: BatchIdSchema,
        /** The record's fields without its id. */
        fields: z.record(z.string(), z.unknown()),
        reason: z.string().min(1).optional(),
      }),
    )
    .output(WrittenSchema),
  edit: contentProcedure
    .route({
      method: 'PUT',
      path: `${recordPath}/{id}`,
      summary: "Replace a record's fields",
      tags: ['admin'],
    })
    .errors(writeErrors)
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        id: z.string(),
        batchId: BatchIdSchema,
        /** The record version the edit was made from. */
        recordVersion: z.number().int().positive(),
        fields: z.record(z.string(), z.unknown()),
        reason: z.string().min(1).optional(),
      }),
    )
    .output(WrittenSchema),
  retire: contentProcedure
    .route({
      method: 'POST',
      path: `${recordPath}/{id}/retire`,
      summary: 'Retire a record: it stays, marked retired',
      tags: ['admin'],
    })
    .errors(writeErrors)
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        id: z.string(),
        batchId: BatchIdSchema,
        recordVersion: z.number().int().positive(),
        reason: z.string().min(1).optional(),
      }),
    )
    .output(WrittenSchema),
  flag: contentProcedure
    .route({
      method: 'POST',
      path: `${recordPath}/{id}/flag`,
      summary: 'Flag a record for the Content queue',
      description: 'A flag changes no content: it is an Action log row the Content queue lists.',
      tags: ['admin'],
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        kind: ContentRecordKindSchema,
        id: z.string(),
        batchId: BatchIdSchema,
        reason: z.string().min(1),
      }),
    )
    .output(z.object({ id: z.string(), batchId: z.string() })),
  record: contentProcedure
    .route({
      method: 'GET',
      path: `${recordPath}/{id}`,
      summary: "A record's fields and its record version, which an edit is made from",
      tags: ['admin'],
    })
    .input(
      z.strictObject({ editionId: EditionIdSchema, kind: ContentRecordKindSchema, id: z.string() }),
    )
    .output(
      z.object({
        fields: z.record(z.string(), z.unknown()),
        recordVersion: z.number().int().positive(),
      }),
    ),
  report: contentProcedure
    .route({
      method: 'GET',
      path: '/admin/content/{editionId}/report',
      summary: "Counts of the content against the Edition's content targets",
      tags: ['admin'],
    })
    .input(z.strictObject({ editionId: EditionIdSchema }))
    .output(
      z.object({
        contentVersion: z.number().int().positive(),
        report: ContentReportSchema,
        targets: ContentTargetsSchema,
        /** Each target the content falls short of. */
        missed: z.array(z.object({ target: z.string(), message: z.string() })),
        /**
         * The quote check (ADR 0084): records changed since their last check, and
         * records whose quote was not found on their source page.
         */
        quoteCheck: z.object({
          unverified: z.number().int().nonnegative(),
          failed: z.number().int().nonnegative(),
        }),
      }),
    ),
};

/**
 * The admin API (ADR 0088): what `apps/admin` and an Агент know of the
 * backend. Every procedure answers 404 while no Власник exists. An Агент
 * token, sent as `Authorization: Bearer <token>`, is taken by the
 * content-writing procedures only: anywhere else a token answers 403, and
 * one that is unknown or revoked answers 401.
 */
export const adminContract = {
  status: procedure
    .route({
      method: 'GET',
      path: '/admin/status',
      summary: 'Whether the owner admin is on',
      description: 'The admin is on once a Власник exists; until then it answers 404.',
      tags: ['admin'],
    })
    .errors({
      NOT_FOUND: { message: 'Not found' },
      UNAUTHORIZED: { message: 'The Агент token is unknown or revoked' },
      FORBIDDEN: { message: 'An Агент token writes content only' },
    })
    .output(z.object({ on: z.literal(true) })),
  content: contentWriteContract,
};
