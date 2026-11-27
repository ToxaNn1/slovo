import { describe, expect, it } from 'vitest';

import type { AnswerSheet } from './answer-form';
import { chipsForm, outOfOrder, type ChipsContent } from './chips-form';
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
    });
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

  it('judges nothing for a chip tapped twice', () => {
    expect(
      chipsForm.judge(content, round, { form: 'chips', chips: [1, 1, 3, 0] }, testComparison),
    ).toBeUndefined();
  });

  it("moves the chips on when a shuffle left the answer's in order, decoys after them counted", () => {
    expect(outOfOrder(['a', 'b'], ['a', 'b', 'x'], testComparison)).toEqual(['b', 'x', 'a']);
    expect(outOfOrder(['a', 'b'], ['b', 'a', 'x'], testComparison)).toEqual(['b', 'a', 'x']);
  });

  it('judges nothing for a chip the Round does not have', () => {
    expect(
      chipsForm.judge(content, round, { form: 'chips', chips: [1, 2, 3, 4] }, testComparison),
    ).toBeUndefined();
  });

  it('is well formed only when the chips are the answer reordered', () => {
    expect(chipsForm.wellFormed(content)).toBe(true);
    expect(chipsForm.wellFormed({ ...content, chips: ['д', 'з', 'ї', 'ї'] })).toBe(false);
    expect(chipsForm.wellFormed({ ...content, chips: ['д', 'з', 'х', 'з', 'ї'] })).toBe(false);
    expect(chipsForm.wellFormed({ ...content, chips: [], expected: [] })).toBe(false);
  });

  it('spans one Round and asks about no other Entry', () => {
    expect(chipsForm.roundsIn(content)).toBe(1);
    expect(chipsForm.entriesIn(content)).toEqual([]);
  });
});
