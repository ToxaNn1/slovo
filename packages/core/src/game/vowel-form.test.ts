import { describe, expect, it } from 'vitest';

import type { AnswerSheet } from './answer-form';
import { vowelForm, type VowelContent } from './vowel-form';

const sheet: AnswerSheet = {
  answer: { text: 'вимо́ва', stressedVowels: ['о'] },
  example: undefined,
};
const content: VowelContent = { form: 'vowel', vowels: [1, 3, 5], stressed: [3], sheet };
const round = { ...vowelForm.shown(content, []), prompt: 'вимова' };

describe('the vowel form', () => {
  it('shows the vowels to tap, the stressed ones kept out', () => {
    expect(vowelForm.shown(content, [])).toEqual({ form: 'vowel', vowels: [1, 3, 5] });
  });

  it('judges a stressed vowel right, with the sheet', () => {
    expect(vowelForm.judge(content, round, { form: 'vowel', position: 3 })).toEqual({
      answer: { form: 'vowel', chosen: 3, stressed: [3], right: true, sheet },
    });
  });

  it('judges any of several stressed vowels right', () => {
    const both = { ...content, stressed: [1, 3] };
    expect(vowelForm.judge(both, round, { form: 'vowel', position: 1 })?.answer.right).toBe(true);
  });

  it('judges another vowel wrong', () => {
    expect(vowelForm.judge(content, round, { form: 'vowel', position: 5 })?.answer.right).toBe(
      false,
    );
  });

  it('judges nothing for a place that is no vowel to tap', () => {
    expect(vowelForm.judge(content, round, { form: 'vowel', position: 2 })).toBeUndefined();
  });

  it('shows the prompt stressed on the vowel tapped in the Game Review', () => {
    const judged = vowelForm.judge(content, round, { form: 'vowel', position: 5 });
    expect(judged && vowelForm.reviewAnswer(round, judged.answer)).toEqual({
      text: 'вимова́',
      stressedVowels: ['а'],
    });
  });

  it('spans one Round and no other Entry', () => {
    expect(vowelForm.roundsIn(content)).toBe(1);
    expect(vowelForm.entriesIn(content)).toEqual([]);
  });

  it('is well formed with a stressed vowel among the vowels to tap', () => {
    expect(vowelForm.wellFormed(content)).toBe(true);
    expect(vowelForm.wellFormed({ ...content, stressed: [] })).toBe(false);
    expect(vowelForm.wellFormed({ ...content, stressed: [2] })).toBe(false);
  });
});
