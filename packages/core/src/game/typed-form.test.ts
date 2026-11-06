import { describe, expect, it } from 'vitest';

import type { AnswerSheet } from './answer-form';
import { typedForm, type TypedContent } from './typed-form';

const sheet: AnswerSheet = {
  answer: { text: 'пʼять', stressedVowels: [] },
  example: undefined,
};
const content: TypedContent = { form: 'typed', expected: 'пʼять', sheet };
const blanked: TypedContent = { ...content, blanks: { inPlace: [1] } };
const round = { ...typedForm.shown(content, []), prompt: 'Число' };

describe('the typed form', () => {
  it('shows no blanks when the content has none, and no letter to open', () => {
    expect(typedForm.shown(content, [])).toEqual({
      form: 'typed',
      blanks: undefined,
      canOpenLetter: false,
    });
  });

  it('shows one blank per character, the characters in place as marks', () => {
    expect(typedForm.shown(blanked, [])).toEqual({
      form: 'typed',
      blanks: [{}, { mark: 'ʼ' }, {}, {}, {}],
      canOpenLetter: true,
    });
  });

  it('opens the first blank with its letter', () => {
    const opened = typedForm.openLetter(blanked, typedForm.shown(blanked, []));
    expect(opened?.blanks).toEqual([{ letter: 'п' }, { mark: 'ʼ' }, {}, {}, {}]);
    expect(opened?.canOpenLetter).toBe(true);
  });

  it('opens letters while more than one blank is left', () => {
    let shown = typedForm.shown(blanked, []);
    for (let open = 0; open < 3; open += 1) {
      const opened = typedForm.openLetter(blanked, shown);
      if (opened === undefined) throw new Error('A letter should open');
      shown = opened;
    }
    expect(shown.blanks).toEqual([
      { letter: 'п' },
      { mark: 'ʼ' },
      { letter: 'я' },
      { letter: 'т' },
      {},
    ]);
    expect(shown.canOpenLetter).toBe(false);
    expect(typedForm.openLetter(blanked, shown)).toBeUndefined();
  });

  it('opens no letter in a Round without blanks', () => {
    expect(typedForm.openLetter(content, typedForm.shown(content, []))).toBeUndefined();
  });

  it('judges the text typed right the way typed answers compare', () => {
    expect(typedForm.judge(content, round, { form: 'typed', text: " П'ять " })).toEqual({
      answer: { form: 'typed', typed: " П'ять ", expected: 'пʼять', right: true, sheet },
    });
  });

  it('judges other text wrong', () => {
    expect(typedForm.judge(content, round, { form: 'typed', text: 'пять' })?.answer.right).toBe(
      false,
    );
  });

  it('shows the text typed, trimmed, in the Game Review', () => {
    const judged = typedForm.judge(content, round, { form: 'typed', text: ' пять ' });
    expect(judged && typedForm.reviewAnswer(round, judged.answer)).toEqual({
      text: 'пять',
      stressedVowels: [],
    });
  });

  it('is well formed only with text to type', () => {
    expect(typedForm.wellFormed(content)).toBe(true);
    expect(typedForm.wellFormed({ ...content, expected: '' })).toBe(false);
  });

  it('spans one Round and asks about no other Entry', () => {
    expect(typedForm.roundsIn(content)).toBe(1);
    expect(typedForm.entriesIn(content)).toEqual([]);
  });
});
