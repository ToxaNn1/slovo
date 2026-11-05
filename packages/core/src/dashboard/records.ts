import { z } from 'zod';

import { declareRecords } from '../user-state/user-state-record';

/** The records of the Dashboard. */
export const dashboardRecords = {
  /**
   * The Corrections «розібрано», one record per Correction by its id: the
   * reader saw its standard form, on the Feed or through «Як правильно?»
   * on a Correction Type's screen (ADR 0076). They sync as a union, like the
   * Active Days, so a Correction worked through on one device counts on all.
   */
  correctionsWorkedThrough: declareRecords('correctionsWorkedThrough.', z.literal(true), {
    sync: 'union',
  }),
  /**
   * The Curated Collections opened, one record per collection by its id
   * (ADR 0076). They sync as a union, so a collection opened on one device
   * loses its «Нова» badge on all.
   */
  curatedCollectionsOpened: declareRecords('curatedCollections.opened.', z.literal(true), {
    sync: 'union',
  }),
};
