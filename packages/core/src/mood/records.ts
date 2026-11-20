import { z } from 'zod';

import { declareRecords } from '../user-state/user-state-record';

/**
 * The Mood check-in of one local day: its date and the choice, a
 * mood id, `skipped` or `unpicked`. An unknown id, from an older Edition, reads as asking.
 */
const MoodCheckInRecordSchema = z.object({
  date: z.string(),
  choice: z.string(),
});

/** The records of Mood. */
export const moodRecords = {
  /**
   * The check-in of each local day under `mood.<date>`, unmarked: it syncs by
   * last write wins, so a change on one device wins on the others.
   */
  checkIns: declareRecords('mood.', MoodCheckInRecordSchema),
};
