import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test/test-support';
import { useDueQuiz } from './due-quiz';

describe('the Due Quiz hook', () => {
  it('asks nothing while nothing is due', async () => {
    const { composition, hook } = await renderOverComposition(() => useDueQuiz());

    await settled(() => composition.knowledge.set('w_one', 'unknown'));

    expect(hook.result.current.questions).toEqual([]);
  });

  it('asks a Word due today and lets it go once answered', async () => {
    const { composition, hook } = await renderOverComposition(() => useDueQuiz(), {
      knowledge: { w_one: { mark: 'unknown', step: 1, reviewDay: '2026-10-13', learned: false } },
    });
    await settled(() => undefined);

    const [question] = hook.result.current.questions;
    expect(hook.result.current.questions).toHaveLength(1);
    expect(question?.lemma).toBe('one');
    expect(question?.meanings[question.right]).toBe('The meaning of one.');

    await settled(() => {
      if (question !== undefined) hook.result.current.answer(question, question.right);
    });

    expect(hook.result.current.questions).toEqual([]);
    expect(composition.knowledge.state.due).toEqual([]);
  });
});
