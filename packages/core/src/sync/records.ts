import { z } from 'zod';

import { declareRecord, declareRecords, InstantSchema } from '../user-state/user-state-record';

/** The records of Sync. */
export const syncRecords = {
  /**
   * The changes of synced records not yet sent to the Account, one record per
   * changed record, by its key: the instant it changed and its new text, or
   * `null` for a deletion (a tombstone). The tracked user state writes one with
   * each write of a synced record (0.8); it never syncs itself.
   */
  syncPending: declareRecords(
    'sync.pending.',
    z.object({ changedAt: InstantSchema, value: z.string().nullable() }),
    { sync: 'device-only' },
  ),
  /** The Sync cursor: the server's sequence number of the last record pulled; without it, no sync has pulled yet. */
  syncCursor: declareRecord('sync.cursor', z.number().int().nonnegative(), {
    sync: 'device-only',
  }),
  /**
   * The instant the last sync of this device's Session went through, for the
   * status line; without it, none has. Forgotten with the cursor when the
   * Session ends.
   */
  syncSyncedAt: declareRecord('sync.syncedAt', InstantSchema, { sync: 'device-only' }),
};
