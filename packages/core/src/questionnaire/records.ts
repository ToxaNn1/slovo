import { z } from 'zod';

import { declareRecord } from '../user-state/user-state-record';
import { LATER_QUESTIONS } from '../feed-notice';

/** The records of the questionnaire. */
export const questionnaireRecords = {
  /**
   * The later questions offered on this device through a Feed Notice, each
   * once, in order; the local date `date` the last one was offered, which
   * stays its day; and whether the self-rating asked to offer the Rarity Test
   * (ADR 0067). Without the record none was offered. It stays on the device,
   * like the onboarding finished.
   */
  laterQuestions: declareRecord(
    'questionnaire.later',
    z.object({
      asked: z.array(z.enum(LATER_QUESTIONS)),
      date: z.string().optional(),
      offerRarityTest: z.boolean().optional(),
    }),
    { sync: 'device-only' },
  ),
};
