import { renderStress, stressedVowelsOf } from '../entries/stress';
import type { GameMode } from './game-mode';

/**
 * «Наголос», the Core's Stress mode (ADR 0052), on when the Edition marks
 * Stress and turns the mode on: a Round shows a Word's Lemma without Stress,
 * each of its vowels, by the Edition's vowels, a button; any of its stressed
 * vowels is right. A Word with one vowel never plays, since its Round would
 * be trivial. Its sheet shows the Lemma with its Stress and its first
 * Example, if it has one.
 */
export const stressMode: GameMode = {
  id: 'stress',
  entryKind: 'word',
  isOn: (edition) =>
    edition.isFeatureEnabled('gameStress') && edition.languageTraits.marksStress === true,
  buildRound({ answer, edition }) {
    if (answer.kind !== 'word') return undefined;
    const editionVowels = new Set(edition.languageTraits.vowels);
    const vowels = Array.from(answer.lemma).flatMap((character, place) =>
      editionVowels.has(character.toLowerCase()) ? [place] : [],
    );
    const stressed = answer.stress.filter((place) => vowels.includes(place));
    if (vowels.length < 2 || stressed.length === 0) return undefined;
    return {
      form: 'vowel',
      prompt: answer.lemma,
      vowels,
      stressed,
      sheet: {
        answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
        example: answer.examples[0],
      },
    };
  },
};
