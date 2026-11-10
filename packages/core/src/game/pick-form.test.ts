import { describe, expect, it } from 'vitest';

import type { AnswerSheet, RoundOption } from './answer-form';
import { pickForm, type PickContent } from './pick-form';
import { testComparison } from '../test-support';

const option = (text: string): RoundOption => ({ text, stressedVowels: [] });
const sheet: AnswerSheet = { answer: option('ганок'), example: undefined };
const content: PickContent = {
  form: 'pick',
  options: ['поріг', 'ганок', 'сіни', 'хата'].map(option),
  correct: 1,
  sheet,
};
const round = { ...pickForm.shown(content, []), prompt: 'Прибудова перед входом' };

describe('the pick form', () => {
  it('shows the options in their order, the right one kept out', () => {
    expect(pickForm.shown(content, [])).toEqual({ form: 'pick', options: content.options });
  });

  it('judges the right option right, with the sheet', () => {
    expect(pickForm.judge(content, round, { form: 'pick', option: 1 }, testComparison)).toEqual({
      answer: { form: 'pick', chosen: 1, correct: 1, right: true, sheet },
    });
  });

  it('judges another option wrong', () => {
    expect(
      pickForm.judge(content, round, { form: 'pick', option: 3 }, testComparison)?.answer.right,
    ).toBe(false);
  });

  it('judges nothing for an option the Round does not have', () => {
    expect(
      pickForm.judge(content, round, { form: 'pick', option: 4 }, testComparison),
    ).toBeUndefined();
  });

  it('shows the option picked in the Game Review', () => {
    const judged = pickForm.judge(content, round, { form: 'pick', option: 2 }, testComparison);
    expect(judged && pickForm.reviewAnswer(round, judged.answer)).toEqual(option('сіни'));
  });

  it('spans one Round and no other Entry', () => {
    expect(pickForm.roundsIn(content)).toBe(1);
    expect(pickForm.entriesIn(content)).toEqual([]);
  });

  it('is well formed with four options and the right one among them', () => {
    expect(pickForm.wellFormed(content)).toBe(true);
    expect(pickForm.wellFormed({ ...content, correct: 4 })).toBe(false);
    expect(pickForm.wellFormed({ ...content, options: content.options.slice(1) })).toBe(false);
  });
});
