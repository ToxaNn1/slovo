import { renderStress, stressedVowelsOf } from '../entries/stress';
import { outOfOrder, type FixedChip } from './chips-form';
import type { GameMode } from './game-mode';
import { shuffled } from '../shuffled';

/** How many letters a Word that plays has, at least and at most. */
const LETTERS = { min: 4, max: 9 } as const;

/**
 * «Анаграми», the Core's anagram mode (ADR 0052): a Round shows a Word's
 * primary Definition and its letters as shuffled chips, tapped in order to
 * assemble the Word; equal letters are interchangeable. A character the
 * Edition reads as an apostrophe, or a hyphen, stays in place and is no chip. Only Words of 4–9 letters with no
 * space play. Its sheet shows the Lemma with its Stress and its first
 * Example, if it has one.
 */
export const anagramMode: GameMode = {
  id: 'anagram',
  group: 'words',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gameAnagram'),
  buildRound({ answer, random, comparison }) {
    if (answer.kind !== 'word' || answer.lemma.includes(' ')) return undefined;
    const letters: string[] = [];
    const fixed: FixedChip[] = [];
    for (const character of answer.lemma) {
      if (character === '-' || comparison.isApostrophe(character)) fixed.push({ at: letters.length, text: character });
      else letters.push(character);
    }
    if (letters.length < LETTERS.min || letters.length > LETTERS.max) return undefined;
    return {
      form: 'chips',
      chipKind: 'letter',
      prompt: answer.primaryDefinition,
      chips: outOfOrder(letters, shuffled(letters, random), comparison),
      expected: letters,
      fixed,
      sheet: {
        answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
        example: answer.examples[0],
      },
    };
  },
};
