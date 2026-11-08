import { declareRecord, InstantSchema } from '../user-state/user-state-record';

/** The records of the content update. */
export const contentUpdateRecords = {
  /**
   * Retired: the instant the last daily check for a downloaded pack started.
   * A check for a Patch is due at every launch and foreground (ADR 0090), so
   * nothing reads it; it stays declared so a device that stored it still
   * reads its user state.
   */
  contentUpdateCheckedAt: declareRecord('contentUpdate.checkedAt', InstantSchema, {
    sync: 'device-only',
  }),
};
