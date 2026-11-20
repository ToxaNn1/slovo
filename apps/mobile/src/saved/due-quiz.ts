import type { DueQuestion } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';

/**
 * The Due Quiz «Перевір себе» over the «Вчу» list: the questions
 * of today, asked again with every Knowledge Mark and every new local day, so
 * an answered Word leaves them, and `answer`, which marks the Word. No
 * questions with the `dueQuiz` Feature Switch off.
 */
export function useDueQuiz(): {
  questions: readonly DueQuestion[];
  answer: (question: DueQuestion, option: number) => void;
} {
  const { knowledge, dueQuiz } = useComposition();
  const marks = useSubscribed(knowledge, ({ state }) => state);
  const [questions, setQuestions] = useState<readonly DueQuestion[]>([]);
  useEffect(() => {
    let current = true;
    dueQuiz.questions().then(
      (asked) => {
        if (current) setQuestions(asked);
      },
      (error: unknown) => {
        logError('Could not ask the Due Quiz', error);
      },
    );
    return () => {
      current = false;
    };
  }, [dueQuiz, marks]);
  const answer = (question: DueQuestion, option: number) => {
    dueQuiz.answer(question, option).catch((error: unknown) => {
      logError('Could not mark a Word from the Due Quiz', error);
    });
  };
  return { questions, answer };
}
