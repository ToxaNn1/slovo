import type { LanguageTraits } from '@slovo/contracts';

import {
  markedStressedVowelsOf,
  renderStress,
  STRESS_MARK,
  stressedVowelsOf,
  withoutStress,
} from '../entries/stress';
import type { AnswerSheet, GameMode, RoundContent } from './game-mode';

/**
 * A vowel Round of the text, its Stress set apart: each vowel, by the
 * Edition's vowels, a button, the stressed ones right; nothing when the text
 * has one vowel or no stressed one, since its Round would be trivial.
 */
function vowelRound(
  text: string,
  stress: readonly number[],
  edition: { readonly languageTraits: Partial<Pick<LanguageTraits, 'vowels'>> },
  sheet: AnswerSheet,
): RoundContent | undefined {
  const editionVowels = new Set(edition.languageTraits.vowels);
  const vowels = Array.from(text).flatMap((character, place) =>
    editionVowels.has(character.toLowerCase()) ? [place] : [],
  );
  const stressed = stress.filter((place) => vowels.includes(place));
  if (vowels.length < 2 || stressed.length === 0) return undefined;
  return { form: 'vowel', prompt: text, vowels, stressed, sheet };
}

/** Where in the text without its Stress marks each stressed vowel stands (ADR 0045). */
function markedStressOf(text: string): number[] {
  const stress: number[] = [];
  let place = 0;
  for (const character of text) {
    if (character === STRESS_MARK) stress.push(place - 1);
    else place += 1;
  }
  return stress;
}

/**
 * «Наголос», the Core's Stress mode (ADR 0052), on when the Edition marks
 * Stress and turns the mode on: a Round shows a Word's Lemma without Stress,
 * each of its vowels, by the Edition's vowels, a button; any of its stressed
 * vowels is right. A Word with one vowel never plays, since its Round would
 * be trivial. Its sheet shows the Lemma with its Stress and its first
 * Example, if it has one. A stress trap, a `wrongStress` Correction in the
 * Mix, plays too: its main standard equivalent without Stress, the answer
 * that form's Stress, its sheet the form with its Stress and the
 * Correction's explanation (ADR 0045).
 */
export const stressMode: GameMode = {
  id: 'stress',
  entryKind: 'word',
  alsoAsks: ['correction'],
  isOn: (edition) =>
    edition.isFeatureEnabled('gameStress') && edition.languageTraits.marksStress === true,
  buildRound({ answer, edition }) {
    if (answer.kind === 'word') {
      return vowelRound(answer.lemma, answer.stress, edition, {
        answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
        example: answer.examples[0],
      });
    }
    if (answer.kind !== 'correction' || answer.correctionType !== 'wrongStress') return undefined;
    const form = answer.standardEquivalents[0] ?? '';
    return vowelRound(withoutStress(form), markedStressOf(form), edition, {
      answer: { text: form, stressedVowels: markedStressedVowelsOf(form) },
      example: undefined,
      explanation: answer.explanation,
    });
  },
};
