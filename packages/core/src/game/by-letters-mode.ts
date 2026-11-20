import { renderStress, stressedVowelsOf } from '../entries/stress';
import type { GameMode } from './game-mode';
import type { TextComparison } from '../text/text-comparison';

/** Whether a character of a Word stays in place, never a blank: one the Edition reads as an apostrophe, or a hyphen. */
const staysInPlace = (character: string, comparison: TextComparison): boolean =>
  character === '-' || comparison.isApostrophe(character);

/**
 * «За літерами», the Core's letters mode: a Round shows a Word's
 * primary Definition. A blank stands for each
 * letter and the reader types the Word, compared by its Comparison Key as a
 * typed answer; «Відкрити літеру» opens one letter at a time until one is
 * left, at no cost. A character the Edition reads as an apostrophe, or a
 * hyphen, stays in place and is no blank; a Word with a space never plays. Its sheet shows
 * the Lemma with its Stress and its first Example, if it has one.
 */
export const byLettersMode: GameMode = {
  id: 'by-letters',
  group: 'new',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gameByLetters'),
  buildRound({ answer, comparison }) {
    if (answer.kind !== 'word' || answer.lemma.includes(' ')) return undefined;
    const sheet = {
      answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
      example: answer.examples[0],
    };
    const inPlace = Array.from(answer.lemma).flatMap((character, place) =>
      staysInPlace(character, comparison) ? [place] : [],
    );
    return {
      form: 'typed',
      prompt: answer.primaryDefinition,
      expected: answer.lemma,
      blanks: { inPlace },
      sheet,
    };
  },
};
