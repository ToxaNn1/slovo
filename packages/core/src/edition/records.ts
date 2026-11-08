import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';

/** A force-update minimum as the backend answers it. */
const minimum = z.object({ soft: z.string().optional(), hard: z.string().optional() });

/** The records of the Edition. */
export const editionRecords = {
  /**
   * The last answer of the backend's remote Feature Switches (ADR 0089): the
   * Rules, read leniently, the force-update minimums, the ETag that names
   * them and how far the backend's clock was ahead of the device's. Without
   * the record, or with one of the older shape, none is known and the
   * Edition's own states hold. It stays on the device: each device asks for
   * itself.
   */
  remoteSwitches: declareRecord(
    'edition.switches',
    z.object({
      rules: z.array(
        z.object({
          id: z.string(),
          feature: z.string(),
          verdict: z.unknown(),
          targets: z.record(z.string(), z.unknown()),
        }),
      ),
      minimums: z.object({ ios: minimum.optional(), android: minimum.optional() }),
      etag: z.string(),
      clockOffsetMs: z.number(),
    }),
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
