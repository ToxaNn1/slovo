import { describe, expect, it } from 'vitest';

import type { AnswerSheet } from './answer-form';
import { chipsForm, type ChipsContent } from './chips-form';
import { testComparison } from '../test-support';

const sheet: AnswerSheet = {
  answer: { text: 'зʼїзд', stressedVowels: [] },
  example: undefined,
};
const content: ChipsContent = {
  form: 'chips',
  chipKind: 'letter',
  chips: ['д', 'з', 'з', 'ї'],
  expected: ['з', 'з', 'ї', 'д'],
  fixed: [{ at: 1, text: 'ʼ' }],
  sheet,
};
const round = { ...chipsForm.shown(content, []), prompt: 'Поїздка' };

describe('the chips form', () => {
  it('shows the chips and the characters that stay in place, the right order kept out', () => {
    expect(chipsForm.shown(content, [])).toEqual({
      form: 'chips',
      chipKind: 'letter',
      chips: ['д', 'з', 'з', 'ї'],
      fixed: [{ at: 1, text: 'ʼ' }],
      layout: 'line',
      slots: 4,
    });
  });

  it('takes decoys among letter tiles only, the answer drawn from the tiles', () => {
    const tiles: ChipsContent = { ...content, chips: ['д', 'з', 'х', 'з', 'ї', 'к'] };

    expect(chipsForm.wellFormed({ ...tiles, layout: 'tiles' })).toBe(true);
    expect(chipsForm.shown({ ...tiles, layout: 'tiles' }, [])).toMatchObject({
      layout: 'tiles',
      slots: 4,
    });
    expect(chipsForm.wellFormed(tiles)).toBe(false);
    expect(chipsForm.wellFormed({ ...tiles, layout: 'tiles', expected: ['з', 'з', 'з'] })).toBe(
      false,
    );
  });

  it('shows no fixed characters when the content has none', () => {
    const { fixed: _, ...plain } = content;
    expect(chipsForm.shown(plain, []).fixed).toEqual([]);
  });

  it('judges the chips in the right order right, equal chips interchangeable', () => {
    expect(
      chipsForm.judge(content, round, { form: 'chips', chips: [2, 1, 3, 0] }, testComparison),
    ).toEqual({
      answer: {
        form: 'chips',
        chosen: [2, 1, 3, 0],
        expected: ['з', 'з', 'ї', 'д'],
        right: true,
        sheet,
      },
    });
  });

  it('judges the chips in another order wrong', () => {
    expect(
      chipsForm.judge(content, round, { form: 'chips', chips: [0, 1, 2, 3] }, testComparison)
        ?.answer.right,
    ).toBe(false);
  });

  it('judges nothing for a chip the Round does not have', () => {
    expect(
      chipsForm.judge(content, round, { form: 'chips', chips: [1, 2, 3, 4] }, testComparison),
    ).toBeUndefined();
  });

  it('is well formed only when the chips are the answer reordered', () => {
    expect(chipsForm.wellFormed(content)).toBe(true);
    expect(chipsForm.wellFormed({ ...content, chips: ['д', 'з', 'ї', 'ї'] })).toBe(false);
    expect(chipsForm.wellFormed({ ...content, chips: [], expected: [] })).toBe(false);
  });

  it('shows the letters tapped as one Word in the Game Review, the fixed characters in place', () => {
    const judged = chipsForm.judge(
      content,
      round,
      { form: 'chips', chips: [0, 1, 2, 3] },
      testComparison,
    );
    expect(judged && chipsForm.reviewAnswer(round, judged.answer)).toEqual({
      text: 'дʼззї',
      stressedVowels: [],
    });
  });

  it('shows word chips joined with spaces in the Game Review', () => {
    const words: ChipsContent = {
      form: 'chips',
      chipKind: 'word',
      chips: ['байдики', 'бити'],
      expected: ['бити', 'байдики'],
      sheet,
    };
    const shown = { ...chipsForm.shown(words, []), prompt: 'Ледарювати' };
    const judged = chipsForm.judge(words, shown, { form: 'chips', chips: [0, 1] }, testComparison);
    expect(judged && chipsForm.reviewAnswer(shown, judged.answer)?.text).toBe('байдики бити');
  });

  it('spans one Round and asks about no other Entry', () => {
    expect(chipsForm.roundsIn(content)).toBe(1);
    expect(chipsForm.entriesIn(content)).toEqual([]);
  });
});
