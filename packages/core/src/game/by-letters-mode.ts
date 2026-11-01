import { renderStress, stressedVowelsOf } from '../entries/stress';
import type { GameMode } from './game-mode';

/** The characters of a Word that stay in place and are never blanks: an apostrophe of any kind or a hyphen. */
const IN_PLACE = new Set(["'", 'ʼ', '’', '-']);

/** Whether a character of a Word stays in place among its blanks: an apostrophe of any kind or a hyphen. */
const staysInPlace = (character: string): boolean => IN_PLACE.has(character);

/**
 * «За буквами», the Core's typing mode (ADR 0052): a Round shows a Word's
 * primary Definition and a blank for each of its letters; the reader types
 * the Word, compared the way `typedAnswerMatches` does. «Відкрити літеру»
 * opens one letter at a time until one is left, at no cost. An apostrophe or
 * a hyphen stays in place and is no blank; a Word with a space never plays.
 * Its sheet shows the Lemma with its Stress and its first Example, if it has
 * one.
 */
export const byLettersMode: GameMode = {
  id: 'by-letters',
  group: 'words',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gameByLetters'),
  buildRound({ answer }) {
    if (answer.kind !== 'word' || answer.lemma.includes(' ')) return undefined;
    const inPlace = Array.from(answer.lemma).flatMap((character, place) =>
      staysInPlace(character) ? [place] : [],
    );
    return {
      form: 'typed',
      prompt: answer.primaryDefinition,
      expected: answer.lemma,
      blanks: { inPlace },
      sheet: {
        answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
        example: answer.examples[0],
      },
    };
  },
};
