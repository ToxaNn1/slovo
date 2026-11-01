import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** The records of Search. */
export const searchRecords = {
  /**
   * The last 10 Search queries a result was opened from, newest first, no two
   * alike as Search reads them (ADR 0054). It stays on the device; a new key
   * needs no migration.
   */
  recentQueries: declareRecord('search.recentQueries', z.array(z.string()).max(10), {
    sync: 'device-only',
  }),
};
