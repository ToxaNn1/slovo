import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** The records of the Edition. */
export const editionRecords = {
  /**
   * The last answer of the backend's remote Feature Switches: the features
   * the owner turned off remotely, by name, and the ETag that names them
   * (ADR 0040). Without the record, none is known, and the Edition's own
   * values hold. It stays on the device: each device asks for itself.
   */
  remoteSwitches: declareRecord(
    'edition.switches',
    z.object({ off: z.array(z.string()), etag: z.string() }),
    { sync: 'device-only' },
  ),
};
