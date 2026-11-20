import type { Word } from '@slovo/contracts';

import type { Random } from '../ports';
import { shuffled } from '../shuffled';
import type { TextComparison } from '../text/text-comparison';

/**
 * A quiz of three meanings, as Yesterday and the Due Quiz ask it: the Word's own primary Definition and two of other Words, in
 * the order the quiz shows them.
 */
export interface MeaningQuiz {
  readonly meanings: readonly string[];
  /** The place of the Word's own meaning among `meanings`. */
  readonly right: number;
}

/** The meanings of a quiz. */
const QUIZ_MEANINGS = 3;

/**
 * The Words a Distractor may be, best first: the Words of the answer's part
 * of speech in a random order, then the others in a random order.
 */
const distractorOrder = (answer: Word, others: readonly Word[], random: Random): Word[] => [
  ...shuffled(
    others.filter((other) => other.partOfSpeech === answer.partOfSpeech),
    random,
  ),
  ...shuffled(
    others.filter((other) => other.partOfSpeech !== answer.partOfSpeech),
    random,
  ),
];

/**
 * The quiz of `word` over the `others` Words, in the order `random` gives:
 * its meaning and the first two distinct meanings of other Words, those of
 * its part of speech first; a homonym's never, since the quiz shows the one
 * Lemma. Meanings are distinct by their Comparison Key for a Definition. Nothing when the others have no two such meanings.
 */
export function meaningQuiz(
  word: Word,
  others: readonly Word[],
  random: Random,
  comparison: Pick<TextComparison, 'key'>,
): MeaningQuiz | undefined {
  const keyOf = (meaning: string) => comparison.key(meaning, 'definition');
  const meanings = [word.primaryDefinition];
  const keys = new Set([keyOf(word.primaryDefinition)]);
  const candidates = others.filter((other) => other.lemma !== word.lemma);
  for (const other of distractorOrder(word, candidates, random)) {
    if (meanings.length === QUIZ_MEANINGS) break;
    const key = keyOf(other.primaryDefinition);
    if (keys.has(key)) continue;
    keys.add(key);
    meanings.push(other.primaryDefinition);
  }
  if (meanings.length < QUIZ_MEANINGS) return undefined;
  const order = shuffled(meanings, random);
  return { meanings: order, right: order.indexOf(word.primaryDefinition) };
}
