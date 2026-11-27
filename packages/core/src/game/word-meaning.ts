import type { Word } from '@slovo/contracts';

import type { Random } from '../ports';
import { shuffled } from '../shuffled';
import type { TextComparison } from '../text/text-comparison';
import { ROUND_OPTIONS, type RoundContent, type RoundOption } from './game-mode';
import { areSynonyms, definitionOfEntry, distractorOrder } from './guess-word';

/** The stable id analytics name the Word Meaning question by, where a Game Mode has its own. */
export const WORD_MEANING_ID = 'word-meaning';

const optionOf = (text: string): RoundOption => ({ text, stressedVowels: [] });

/**
 * The Definition a Word shows as an option of the Word Meaning question: its
 * Short Definition, or its primary Definition when it has none (ADR 0211).
 */
const definitionAmongSeveral = (word: Word): string =>
  word.shortDefinition ?? word.primaryDefinition;

/**
 * Whether the Word Meaning question may ask the Word: not when the Definition
 * it would show, its Short Definition or else its primary Definition, holds
 * its own Lemma by the Edition's text comparison, which would give the answer
 * away.
 */
export const asksWordMeaning = (word: Word, comparison: TextComparison): boolean =>
  comparison.find(definitionAmongSeveral(word), word.lemma) === undefined;

/**
 * The Round of the Word Meaning question (CONTEXT.md): the Word's
 * Lemma, asked by its meaning (`labelKind` `meaning`), and four Definitions,
 * whole, its own among them. Each Word shows its Short Definition, or its
 * primary Definition when it has none, as the right option and as a
 * Distractor alike (ADR 0211). The three Distractors are of other Eligible
 * Words, of the same part of speech first and of any other when those are too
 * few, never a Word whose primary Definition or shown text is one of this
 * Word's own Definitions, nor a homonym's nor a synonym's, whichever of the
 * two lists the other, no two options with one Comparison Key of the text
 * shown. Nothing when four distinct Definitions cannot be found. Its sheet
 * shows the primary Definition and the Word's first Example, if it has one.
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
  const keyOf = (text: string) => comparison.key(text, 'definition');
  const right = definitionAmongSeveral(answer);
  const taken = new Set([right, answer.primaryDefinition, ...answer.extraDefinitions].map(keyOf));
  // A homonym shares the Lemma and a synonym the meaning, so either's Definition would be right too.
  const others = eligible.filter(
    (word) =>
      word.id !== answer.id &&
      !comparison.same(word.lemma, answer.lemma, 'typedAnswer') &&
      !areSynonyms(comparison, answer, word),
  );
  const distractors: string[] = [];
  for (const other of distractorOrder(answer, others, random)) {
    if (distractors.length === ROUND_OPTIONS - 1) break;
    const shown = definitionAmongSeveral(other);
    const key = keyOf(shown);
    if (taken.has(key) || taken.has(definitionOfEntry(comparison, other))) continue;
    taken.add(key);
    distractors.push(shown);
  }
  if (distractors.length < ROUND_OPTIONS - 1) return undefined;
  const options = shuffled([right, ...distractors], random);
  return {
    form: 'pick',
    prompt: answer.lemma,
    labelKind: 'meaning',
    options: options.map(optionOf),
    correct: options.indexOf(right),
    sheet: { answer: optionOf(answer.primaryDefinition), example: answer.examples[0] },
  };
}
