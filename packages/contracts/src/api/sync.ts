import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { SYNC_BATCH_SIZE } from '../sync';
import { signedIn } from './procedure';

/** The key of a record of the user state, as the app's Core names it. */
const RecordKeySchema = z.string().min(1);

/**
 * The value of a record as JSON, or `null` for a tombstone: the record is
 * deleted. The backend keeps it without reading it (ADR 0041).
 */
const RecordValueSchema = z.json();

/**
 * When the app's Core wrote the change, in milliseconds since 1970-01-01 UTC,
 * by the device's clock. 0 is older than any change.
 */
const ChangedAtSchema = z.number().int().nonnegative();

/** A cursor of Sync: the server's sequence number of the last record a device pulled. */
const CursorSchema = z.number().int().nonnegative();

/** One change of a record, as a device pushes it and a pull answers it. */
const RecordChangeSchema = z.object({
  key: RecordKeySchema,
  value: RecordValueSchema,
  changedAt: ChangedAtSchema,
});

/** A procedure of Sync, on the Account of its Session in one Edition. */
const ofSync = signedIn.errors({
  /** An Edition the backend doesn't serve, or one with the Account or Sync switched off. */
  NOT_FOUND: { message: 'Not found' },
  /**
   * Over the limit of 120 Sync requests, pushes and pulls together, of one
   * Session in 10 minutes; `Retry-After` says, in seconds, when to try again.
   */
  TOO_MANY_REQUESTS: { message: 'Too many requests' },
});

/**
 * The Sync procedures: a device pushes the changes of its user state and
 * pulls those of the Account's other devices, for its Session's Account in
 * its Edition only. The
 * backend keeps each record as it is, and the later change time wins
 * (ADR 0041).
 */
export const syncContract = {
  push: ofSync
    .route({
      method: 'POST',
      path: '/editions/{editionId}/records',
      summary: "Keep a device's changes of its records",
      description:
        "Each change replaces the record kept under its key only when its change time is later; a change time later than the server's own time counts as the server's. A change that is not later is ignored without an error: the next pull answers the record kept. A key has at most 200 characters and a value at most 8 KB as compact JSON in UTF-8; a push with one over is BAD_REQUEST. An Account keeps at most 20 000 records in an Edition, tombstones included; a push that would go over is TOO_MANY_RECORDS. Either is refused whole.",
      tags: ['sync'],
    })
    .errors({
      /**
       * The push would take the Account's records in the Edition, tombstones
       * included, over 20 000; nothing of it is kept. A change of a record
       * kept is still taken.
       */
      TOO_MANY_RECORDS: { status: 409, message: 'Too many records' },
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        changes: z.array(z.strictObject(RecordChangeSchema.shape)).max(SYNC_BATCH_SIZE),
      }),
    )
    .output(z.object({})),

  pull: ofSync
    .route({
      method: 'GET',
      path: '/editions/{editionId}/records',
      summary: 'The records kept after a cursor',
      description:
        'The records changed after the cursor, in the order the server kept them, with the cursor to ask after next.',
      tags: ['sync'],
    })
    .input(
      z.strictObject({
        editionId: EditionIdSchema,
        /** The cursor the last pull answered; from the first record without one. */
        after: z.coerce.number<number>().int().nonnegative().optional(),
        /** The most records to answer; as many as a page holds without one. */
        limit: z.coerce.number<number>().int().positive().max(SYNC_BATCH_SIZE).optional(),
      }),
    )
    .output(
      z.object({
        /** The records changed after the cursor, oldest change kept first; a tombstone's value is `null`. */
        records: z.array(RecordChangeSchema),
        /** The cursor to ask after next: the last record's, or the one asked after when none came. */
        cursor: CursorSchema,
        /** Whether more records follow the cursor. */
        more: z.boolean(),
      }),
    ),
};
