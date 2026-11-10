import { describe, expect, it } from 'vitest';

import { word, testComparison } from '../test-support';
import { pairsForm, type GridPair, type PairsContent } from './pairs-form';

const pairOf = (id: string, lemma: string, definition: string): GridPair => {
  const option = { text: lemma, stressedVowels: [] };
  return {
    entry: word(id, { lemma, stress: [], primaryDefinition: definition }),
    word: option,
    definition,
    sheet: { answer: option, example: undefined },
  };
};
const [вирій, коса, плай] = [
  pairOf('w_вирій', 'вирій', 'Where birds fly.'),
  pairOf('w_коса', 'коса', 'A braid.'),
  pairOf('w_плай', 'плай', 'A mountain path.'),
] as const;
const content: PairsContent = {
  form: 'pairs',
  pairs: [вирій, коса, плай],
  wordOrder: [1, 0, 2],
  definitionOrder: [2, 1, 0],
};
const fresh = pairsForm.shown(content, []);

describe('the pairs form', () => {
  it('shows the Words and Definitions in their orders, none gone', () => {
    expect(fresh).toEqual({
      form: 'pairs',
      words: [коса.word, вирій.word, плай.word].map((shown) => ({ shown, gone: false })),
      definitions: [плай, коса, вирій].map(({ definition }) => ({
        shown: definition,
        gone: false,
      })),
    });
  });

  it('spans one Round per pair and asks about every pair Entry', () => {
    expect(pairsForm.roundsIn(content)).toBe(3);
    expect(pairsForm.entriesIn(content)).toEqual(['w_вирій', 'w_коса', 'w_плай']);
  });

  it('judges the Word matched with its own Definition right, about the Word tapped', () => {
    expect(
      pairsForm.judge(content, fresh, { form: 'pairs', word: 0, definition: 1 }, testComparison),
    ).toEqual({
      about: коса.entry,
      answer: { form: 'pairs', word: 0, definition: 1, correct: 1, right: true, sheet: коса.sheet },
    });
  });

  it('judges a Word matched with another Definition wrong', () => {
    expect(
      pairsForm.judge(content, fresh, { form: 'pairs', word: 1, definition: 0 }, testComparison)
        ?.answer,
    ).toMatchObject({ right: false, correct: 2 });
  });

  it('takes the pairs answered in the grid, right or wrong, out of the grid', () => {
    const wrong = pairsForm.judge(
      content,
      fresh,
      { form: 'pairs', word: 1, definition: 0 },
      testComparison,
    );
    if (wrong === undefined) throw new Error('The answer was not judged');
    const after = pairsForm.shown(content, [wrong.answer]);
    expect(after.words.map(({ gone }) => gone)).toEqual([false, true, false]);
    expect(after.definitions.map(({ gone }) => gone)).toEqual([false, false, true]);
    expect(
      pairsForm.judge(content, after, { form: 'pairs', word: 1, definition: 1 }, testComparison),
    ).toBe(undefined);
    expect(
      pairsForm.judge(content, after, { form: 'pairs', word: 0, definition: 2 }, testComparison),
    ).toBe(undefined);
  });

  it('judges nothing for a cell the grid does not have', () => {
    expect(
      pairsForm.judge(content, fresh, { form: 'pairs', word: 3, definition: 0 }, testComparison),
    ).toBe(undefined);
  });

  it('reviews a wrong answer as the Definition tapped', () => {
    const round = { ...fresh, prompt: '' };
    const judged = pairsForm.judge(
      content,
      fresh,
      { form: 'pairs', word: 1, definition: 0 },
      testComparison,
    );
    if (judged === undefined) throw new Error('The answer was not judged');
    expect(pairsForm.reviewAnswer(round, judged.answer)).toEqual({
      text: 'A mountain path.',
      stressedVowels: [],
    });
  });

  it('is well formed only with every pair shown once in each order, up to four pairs', () => {
    expect(pairsForm.wellFormed(content)).toBe(true);
    expect(pairsForm.wellFormed({ ...content, wordOrder: [0, 0, 2] })).toBe(false);
    expect(pairsForm.wellFormed({ ...content, definitionOrder: [0, 1] })).toBe(false);
    expect(
      pairsForm.wellFormed({ ...content, pairs: [], wordOrder: [], definitionOrder: [] }),
    ).toBe(false);
    const five = [вирій, коса, плай, вирій, коса];
    const all = [0, 1, 2, 3, 4];
    expect(
      pairsForm.wellFormed({ ...content, pairs: five, wordOrder: all, definitionOrder: all }),
    ).toBe(false);
  });
});
