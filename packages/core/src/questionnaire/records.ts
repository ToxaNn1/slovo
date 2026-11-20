import { z } from 'zod';

import { declareRecord, LocalDateKeySchema } from '../user-state/user-state-record';
import { LATER_QUESTIONS, RETIRED_NOTICE, withoutRetired } from '../feed-notice';

/** The records of the questionnaire. */
export const questionnaireRecords = {
  /**
   * The later questions offered on this device through a Feed Notice, each
   * once, in order; the local date `date` the last one was offered, which
   * stays its day; and whether the self-rating asked to offer the Rarity Test.
   * Without the record none was offered. It stays on the device,
   * like the onboarding finished.
   */
  laterQuestions: declareRecord(
    'questionnaire.later',
    z.object({
      asked: z.array(z.enum([...LATER_QUESTIONS, RETIRED_NOTICE])).transform(withoutRetired),
      date: LocalDateKeySchema.optional(),
      offerRarityTest: z.boolean().optional(),
    }),
    { sync: 'device-only' },
  ),
  /**
   * The last answer the reader gave each question answered with an option
   * («Рівень», «Навіщо», the self-rating), in the onboarding or on the
   * retake, by option id, so the retake starts from it. It stays on
   * the device, like the later questions.
   */
  questionnaireAnswers: declareRecord(
    'questionnaire.answers',
    z.partialRecord(z.enum(['level', 'why', 'selfRating']), z.string()),
    { sync: 'device-only' },
  ),
};
