import { z } from 'zod';

import { declareRecord, InstantSchema } from '../user-state/user-state-record';

/** The records of the onboarding. */
export const onboardingRecords = {
  /**
   * That the onboarding was finished or skipped, and the instant it was;
   * without the record, it opens. It stays on the device: the onboarding asks
   * this device for permission to notify.
   */
  onboardingFinished: declareRecord('onboarding.finished', InstantSchema, { sync: 'device-only' }),
  /**
   * The local date `YYYY-MM-DD` a reader finished or skipped the onboarding
   * with 0.8.13 or later, from which their first week counts its Active Days;
   * without the record, as for a reader who finished it before, there is no
   * first week. It stays on the device, like the onboarding finished (ADR 0054).
   */
  firstWeekFrom: declareRecord('firstWeek.from', z.string(), { sync: 'device-only' }),
};
