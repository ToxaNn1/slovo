
import { declareRecord, InstantSchema } from '../user-state/user-state-record';

/** The records of the content update. */
export const contentUpdateRecords = {
  /**
   * The instant the last check for a content update started; without the
   * record, none has, so one is due. It stays on the device, like the pack it
   * downloads.
   */
  contentUpdateCheckedAt: declareRecord('contentUpdate.checkedAt', InstantSchema, {
    sync: 'device-only',
  }),
};
