import type { DistractorRule, Word } from '@slovo/contracts';

import { ROUND_OPTIONS, shuffled, type GameMode, type RoundOption } from './game';
import type { Random } from './ports';
import { renderStress, stressedVowelsOf } from './stress';

/**
 * The Words a Distractor may be, best first, by each Distractor rule an
 * Edition may choose. `same-part-of-speech`: the Words of the answer's part of
 * speech in a random order, then the others in a random order.
 */
const distractorOrder: Record<
  DistractorRule,
  (answer: Word, others: readonly Word[], random: Random) => Word[]
> = {
  'same-part-of-speech': (answer, others, random) => [
    ...shuffled(
      others.filter((word) => word.partOfSpeech === answer.partOfSpeech),
      random,
    ),
    ...shuffled(
      others.filter((word) => word.partOfSpeech !== answer.partOfSpeech),
      random,
    ),
  ],
};

const optionOf = (word: Word): RoundOption => ({
  text: renderStress(word),
  stressedVowels: stressedVowelsOf(word),
});

/**
 * «Вгадай слово», the Core's Definition → Word mode: a Round shows the
 * answer Word's primary Definition and four Lemmas with their Stress, the
 * three Distractors by the Edition's Distractor rule, no two with the same
 * Lemma, so homonyms never share a Round. Its sheet shows the Lemma and the
 * Word's first Example, if it has one.
 */
export const guessWord: GameMode = {
  id: 'guess-word',
  entryKind: 'word',
  isOn: () => true,
  buildRound({ answer, eligible, random, edition }) {
    if (answer.kind !== 'word') return undefined;
    const others = eligible.filter(
      (entry): entry is Word => entry.kind === 'word' && entry.lemma !== answer.lemma,
    );
    const distractors: Word[] = [];
    for (const word of distractorOrder[edition.languageTraits.distractorRule](
      answer,
      others,
      random,
    )) {
      if (distractors.length === ROUND_OPTIONS - 1) break;
      if (!distractors.some(({ lemma }) => lemma === word.lemma)) distractors.push(word);
    }
    if (distractors.length < ROUND_OPTIONS - 1) return undefined;
    const options = shuffled([answer, ...distractors], random);
    return {
      prompt: answer.primaryDefinition,
      options: options.map(optionOf),
      correct: options.indexOf(answer),
      sheet: { answer: optionOf(answer), example: answer.examples[0] },
    };
  },
};
