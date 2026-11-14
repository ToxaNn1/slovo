import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** The most characters the reader's name holds (ADR 0136). */
const READER_NAME_AT_MOST = 24;

/** The reader's name: trimmed, 1 to 24 characters; an empty one is no name (ADR 0136). */
const ReaderNameSchema = z.string().trim().min(1).max(READER_NAME_AT_MOST);

/** The records of the Profile. */
export const profileRecords = {
  /**
   * The name the reader set on the Profile (ADR 0136). It syncs last write
   * wins like the Theme (ADR 0041) and never leaves through Analytics or a
   * counter; without it the Profile shows no name.
   */
  readerName: declareRecord('profile.name', ReaderNameSchema),
};
