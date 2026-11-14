import type { Word } from '@slovo/contracts';

import type { Random } from '../ports';
import { shuffled } from '../shuffled';
import type { TextComparison } from '../text/text-comparison';
import { ROUND_OPTIONS, type RoundContent, type RoundOption } from './game-mode';

/** The stable id analytics name the Word Meaning question by, where a Game Mode has its own. */
export const WORD_MEANING_ID = 'word-meaning';

const optionOf = (text: string): RoundOption => ({ text, stressedVowels: [] });

/**
 * Whether the Word Meaning question may ask the Word: not when its primary
 * Definition holds its own Lemma, by the Edition's text comparison, which
 * would give the answer away.
 */
export const asksWordMeaning = (word: Word, comparison: TextComparison): boolean =>
  comparison.find(word.primaryDefinition, word.lemma) === undefined;

/**
 * The Round of the Word Meaning question (CONTEXT.md, ADR 0128): the Word's
 * Lemma, asked by its meaning (`labelKind` `meaning`), and four Definitions,
 * whole, its primary Definition among them. The three Distractors are the
 * primary Definitions of other Eligible Words, of the same part of speech
 * first and of any other when those are too few, never one of this Word's
 * own Definitions, no two options with one Comparison Key. Nothing when four
 * distinct Definitions cannot be found. Its sheet shows the primary
 * Definition and the Word's first Example, if it has one.
 */
export function wordMeaningRound({
  answer,
  eligible,
  random,
  comparison,
}: {
  answer: Word;
  /** Every Eligible Word, the answer among them: where Distractors come from. */
  eligible: readonly Word[];
  random: Random;
  comparison: TextComparison;
}): Extract<RoundContent, { readonly form: 'pick' }> | undefined {
  const right = answer.primaryDefinition;
  const keyOf = (text: string) => comparison.key(text, 'definition');
  const taken = new Set([right, ...answer.extraDefinitions].map(keyOf));
  const others = eligible.filter(({ id }) => id !== answer.id);
  const alike = (word: Word) => word.partOfSpeech === answer.partOfSpeech;
  const distractors: string[] = [];
  for (const other of [
    ...shuffled(others.filter(alike), random),
    ...shuffled(
      others.filter((word) => !alike(word)),
      random,
    ),
  ]) {
    if (distractors.length === ROUND_OPTIONS - 1) break;
    const text = other.primaryDefinition;
    if (taken.has(keyOf(text))) continue;
    taken.add(keyOf(text));
    distractors.push(text);
  }
  if (distractors.length < ROUND_OPTIONS - 1) return undefined;
  const options = shuffled([right, ...distractors], random);
  return {
    form: 'pick',
    prompt: answer.lemma,
    labelKind: 'meaning',
    options: options.map(optionOf),
    correct: options.indexOf(right),
    sheet: { answer: optionOf(right), example: answer.examples[0] },
  };
}
