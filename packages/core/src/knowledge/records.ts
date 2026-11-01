import { z } from 'zod';

import { declareRecords, InstantSchema } from '../user-state/user-state-record';

/** The records of the Knowledge Marks and the confirmed Entries. */
export const knowledgeRecords = {
  /**
   * The Knowledge Marks, one record per Entry, by Entry id: the mark, the
   * Review step, the next Review local day, whether the Entry is Learned and,
   * from 0.8.13, the instant the mark was set (ADR 0043, 0054). Removing a mark
   * deletes the record. The mark time is optional, so a record kept before it
   * still reads and needs no migration.
   */
  knowledge: declareRecords(
    'knowledge.',
    z.object({
      mark: z.enum(['known', 'unknown']),
      step: z.literal([1, 3, 7, 30, 90]).nullable(),
      reviewDay: z.iso.date().nullable(),
      learned: z.boolean(),
      markedAt: InstantSchema.exactOptional(),
    }),
  ),
  /**
   * The confirmed Entries, one record per Entry, by Entry id: the instant the
   * Entry was confirmed, Known on a Review of 7 days or later or answered
   * right in a Game or a Quick Question (ADR 0043). A record is never
   * removed: a confirmed Entry stays confirmed whatever its mark does.
   */
  confirmed: declareRecords('confirmed.', InstantSchema),
};
