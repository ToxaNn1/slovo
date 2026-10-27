import { renderStress, stressedVowelsOf } from '../entries/stress';
import { ROUND_OPTIONS, shuffled, type GameMode } from './game-mode';

/**
 * «Звідки слово», the Core's origin mode (ADR 0052): a Round shows a Word's
 * Lemma with its Stress and its primary Definition under it, and four of the
 * Edition's origin languages, the one the Word comes from right; the three
 * Distractors are other languages of the Edition's list. Only Words with an
 * `origin` play, and a Game has 8 Rounds, so the mode needs 8 of them in the
 * Mix; it never starts in an Edition with fewer than four origin languages.
 * Its sheet names the language and shows the Word's etymology, if it has one.
 */
export const originMode: GameMode = {
  id: 'origin',
  entryKind: 'word',
  roundLimit: 8,
  isOn: (edition) => edition.isFeatureEnabled('gameOrigin'),
  buildRound({ answer, random, edition }) {
    if (answer.kind !== 'word') return undefined;
    const languages = edition.originLanguages ?? [];
    const origin = languages.find(({ code }) => code === answer.origin);
    if (origin === undefined || languages.length < ROUND_OPTIONS) return undefined;
    const distractors = shuffled(
      languages.filter((language) => language !== origin),
      random,
    ).slice(0, ROUND_OPTIONS - 1);
    const options = shuffled([origin, ...distractors], random).map(({ name }) => ({
      text: name,
      stressedVowels: [],
    }));
    return {
      form: 'pick',
      prompt: renderStress(answer),
      definition: answer.primaryDefinition,
      options,
      correct: options.findIndex(({ text }) => text === origin.name),
      sheet: {
        answer: { text: origin.name, stressedVowels: [] },
        example: undefined,
        asked: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
        ...(answer.etymology !== undefined && { explanation: answer.etymology }),
      },
    };
  },
};
