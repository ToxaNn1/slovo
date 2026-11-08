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
  /**
   * The Install id (ADR 0089): the device's own random name, made once on the
   * first launch, that picks its share and Variant of the remote Feature
   * Switch Rules. It stays on the device: no request and no sync carries it,
   * so no reader is told apart by it.
   */
  installId: declareRecord('edition.installId', z.string().min(1), { sync: 'device-only' }),
};
