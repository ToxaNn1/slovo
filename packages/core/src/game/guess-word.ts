import type { DistractorRule, Entry, Idiom, Word } from '@slovo/contracts';

import {
  ROUND_OPTIONS,
  shuffled,
  type GameMode,
  type RoundContent,
  type RoundOption,
} from './game-mode';
import type { Random } from '../ports';
import { renderStress, stressedVowelsOf, withoutStress } from '../entries/stress';

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

/** A primary Definition as the reader tells it apart: without case, extra spaces or Stress marks. */
const definitionOf = ({ primaryDefinition }: Word | Idiom) =>
  withoutStress(primaryDefinition).toLowerCase().replace(/\s+/g, ' ').trim();

/** A Word's option, its Lemma with Stress; homonyms share a Lemma, so they never meet in a Round. */
const wordOptions = {
  optionOf: (word: Word): RoundOption => ({
    text: renderStress(word),
    stressedVowels: stressedVowelsOf(word),
  }),
  keyOf: ({ lemma }: Word) => lemma,
};

/** An idiom's option, its expression, which carries no Stress. */
const idiomOptions = {
  optionOf: ({ expression }: Idiom): RoundOption => ({ text: expression, stressedVowels: [] }),
  keyOf: ({ expression }: Idiom) => expression,
};

/** An idiom proper: a place name never plays (ADR 0046). */
const isIdiomProper = (entry: Entry): entry is Idiom =>
  entry.kind === 'idiom' && entry.idiomType === 'idiom';

/**
 * The Round that asks the answer's primary Definition, with three Distractors
 * from the candidates, best first, no two options with the same `keyOf`;
 * nothing when fewer than three are left.
 */
function roundOf<T extends Word | Idiom>(
  answer: T,
  candidates: readonly T[],
  { optionOf, keyOf }: { optionOf: (entry: T) => RoundOption; keyOf: (entry: T) => string },
  random: Random,
): RoundContent | undefined {
  const distractors: T[] = [];
  const keys = new Set([keyOf(answer)]);
  for (const candidate of candidates) {
    if (distractors.length === ROUND_OPTIONS - 1) break;
    if (keys.has(keyOf(candidate))) continue;
    keys.add(keyOf(candidate));
    distractors.push(candidate);
  }
  if (distractors.length < ROUND_OPTIONS - 1) return undefined;
  const options = shuffled([answer, ...distractors], random);
  return {
    prompt: answer.primaryDefinition,
    options: options.map(optionOf),
    correct: options.indexOf(answer),
    sheet: { answer: optionOf(answer), example: answer.examples[0] },
  };
}

/**
 * «Вгадай слово», the Core's Definition → Word mode, which asks about idioms
 * too (ADR 0046). A Round shows the answer's primary Definition and four
 * options, none with the answer's primary Definition, so the prompt fits one
 * option only. A Word's Round offers four Lemmas with their Stress, the three
 * Distractors by the Edition's Distractor rule, no two with the same Lemma,
 * so homonyms never share a Round. An idiom's Round offers four idioms, the
 * three Distractors drawn at random from the other idioms; a place name is
 * never asked or offered. Its sheet shows the answer and its first Example,
 * if it has one.
 */
export const guessWord: GameMode = {
  id: 'guess-word',
  entryKind: 'word',
  alsoAsks: ['idiom'],
  isOn: () => true,
  buildRound({ answer, eligible, random, edition }) {
    if (answer.kind === 'word') {
      const definition = definitionOf(answer);
      const others = eligible.filter(
        (entry): entry is Word => entry.kind === 'word' && definitionOf(entry) !== definition,
      );
      const order = distractorOrder[edition.languageTraits.distractorRule](answer, others, random);
      return roundOf(answer, order, wordOptions, random);
    }
    if (!isIdiomProper(answer)) return undefined;
    const definition = definitionOf(answer);
    const others = eligible.filter(
      (entry): entry is Idiom => isIdiomProper(entry) && definitionOf(entry) !== definition,
    );
    return roundOf(answer, shuffled(others, random), idiomOptions, random);
  },
};
