import { renderStress, stressedVowelsOf } from '../entries/stress';
import { outOfOrder, type FixedChip, type GameMode } from './game-mode';
import { shuffled } from '../shuffled';

/** How many letters a Word that plays has, at least and at most. */
const LETTERS = { min: 4, max: 9 } as const;

/** The characters of a Word that stay in place and are never chips: an apostrophe of any kind or a hyphen. */
const IN_PLACE = new Set(["'", 'ʼ', '’', '-']);

/**
 * «Анаграми», the Core's anagram mode (ADR 0052): a Round shows a Word's
 * primary Definition and its letters as shuffled chips, tapped in order to
 * assemble the Word; equal letters are interchangeable. An apostrophe or a
 * hyphen stays in place and is no chip. Only Words of 4–9 letters with no
 * space play. Its sheet shows the Lemma with its Stress and its first
 * Example, if it has one.
 */
export const anagramMode: GameMode = {
  id: 'anagram',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gameAnagram'),
  buildRound({ answer, random }) {
    if (answer.kind !== 'word' || answer.lemma.includes(' ')) return undefined;
    const letters: string[] = [];
    const fixed: FixedChip[] = [];
    for (const character of answer.lemma) {
      if (IN_PLACE.has(character)) fixed.push({ at: letters.length, text: character });
      else letters.push(character);
    }
    if (letters.length < LETTERS.min || letters.length > LETTERS.max) return undefined;
    return {
      form: 'chips',
      prompt: answer.primaryDefinition,
      chips: outOfOrder(letters, shuffled(letters, random)),
      expected: letters,
      fixed,
      sheet: {
        answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
        example: answer.examples[0],
      },
    };
  },
};
