import { MistakeReportSchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** How many unsent Mistake Reports the device keeps at most (ADR 0056). */
export const MISTAKE_REPORT_QUEUE_SIZE = 20;

/** The records of the Mistake Reports. */
export const mistakeReportRecords = {
  /**
   * The Mistake Reports not yet sent, oldest first, at most
   * `MISTAKE_REPORT_QUEUE_SIZE` (ADR 0056). They stay on the device, with
   * no Sync. A new key, so no migration.
   */
  mistakeReportQueue: declareRecord(
    'reports.queue',
    z.array(MistakeReportSchema).max(MISTAKE_REPORT_QUEUE_SIZE),
    { sync: 'device-only' },
  ),
};
