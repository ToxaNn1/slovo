import { z } from 'zod';

import { EditionIdSchema } from './edition';
import { EntryIdSchema } from './entry';
import { PackMetadataSchema } from './language-pack';

/** How many characters a Mistake Report's comment has at most, trimmed. */
export const REPORT_COMMENT_LENGTH = 500;

/** What a Mistake Report says is wrong. */
export const MistakeTypeSchema = z.enum(['typo', 'stress', 'definition', 'other']);

export type MistakeType = z.output<typeof MistakeTypeSchema>;

/**
 * A Mistake Report as the app sends it (ADR 0056). It carries no Account and
 * no device id: the body has no field for either.
 */
export const MistakeReportSchema = z
  .strictObject({
    editionId: EditionIdSchema,
    /** The id of the Entry reported, of any of the five kinds. */
    entryId: EntryIdSchema,
    type: MistakeTypeSchema,
    /** The reader's comment, trimmed; empty when there is none. */
    comment: z.string().trim().max(REPORT_COMMENT_LENGTH),
    /** The app version, the release it belongs to (ADR 0044). */
    appVersion: z
      .string()
      .regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/, 'Expected a version such as 0.8.14'),
    /** The content version of the Language Pack open when the reader reported. */
    contentVersion: PackMetadataSchema.shape.contentVersion,
  })
  .refine((report) => report.type !== 'other' || report.comment !== '', {
    message: 'A report of type other needs a comment',
    path: ['comment'],
  });

export type MistakeReport = z.output<typeof MistakeReportSchema>;
