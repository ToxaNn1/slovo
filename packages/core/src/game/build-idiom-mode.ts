import type { AskableEntry } from '../entries/entries';
import { outOfOrder } from './chips-form';
import type { GameMode } from './game-mode';
import type { Random } from '../ports';
import { shuffled } from '../shuffled';
import type { TextComparison } from '../text/text-comparison';

/** How many words an expression that plays has, at least and at most. */
const WORDS = { min: 2, max: 8 } as const;

/** How many decoy words a Round holds among the expression's own, with the check on. */
const DECOYS = 3;

/** The words of an expression that are chips, in order: the Edition's expression punctuation dropped. */
const wordsOf = (expression: string, punctuation: ReadonlySet<string>): string[] =>
  expression
    .split(' ')
    .map((word) =>
      Array.from(word, (character) => (punctuation.has(character) ? '' : character)).join(''),
    )
    .filter((word) => word !== '');

/**
 * `DECOYS` words of other expressions, drawn from the random port, no two
 * alike and none like a word of the expression, compared as typed answers;
 * nothing when the other expressions have too few.
 */
function decoysFor(
  words: readonly string[],
  others: readonly string[][],
  random: Random,
  comparison: TextComparison,
): string[] | undefined {
  const keyOf = (word: string) => comparison.key(word, 'typedAnswer');
  const taken = new Set(words.map(keyOf));
  const decoys: string[] = [];
  for (const word of shuffled(others.flat(), random)) {
    if (decoys.length === DECOYS) break;
    if (taken.has(keyOf(word))) continue;
    taken.add(keyOf(word));
    decoys.push(word);
  }
  return decoys.length === DECOYS ? decoys : undefined;
}

/**
 * «Склади вислів», the Core's expression-building mode (ADR 0052), on while
 * the Edition turns Idioms on: a Round shows an idiom's or a proverb's
 * primary Definition and the words of its expression as shuffled chips,
 * tapped in order, compared ignoring case; equal words are interchangeable.
 * The Edition's expression punctuation, such as a comma or a dash, is no
 * chip and no part of one; a hyphen inside a word stays. Only expressions of
 * 2–8 words play, and a place name never does (ADR 0046). Its sheet shows
 * the whole expression and the Idiom's first Example, if it has one.
 * With `buildIdiomCheck` (ADR 0139) the chips stand in the assembly field
 * with three decoy words of other eligible expressions among them, drawn
 * from the random port, and the answer is judged on the check; without it,
 * the last chip gives the answer, as in spec #1674.
 */
export const buildIdiomMode: GameMode = {
  id: 'build-idiom',
  group: 'idioms',
  hubGroup: 'new',
  entryKind: 'idiom',
  isOn: (edition) => edition.isFeatureEnabled('gameBuildIdiom'),
  buildRound({ answer, eligible, random, edition, comparison }) {
    if (answer.kind !== 'idiom' || answer.idiomType === 'placeName') return undefined;
    const punctuation = new Set(edition.languageTraits.expressionPunctuation ?? []);
    const words = wordsOf(answer.expression, punctuation);
    if (words.length < WORDS.min || words.length > WORDS.max) return undefined;
    const sheet = {
      answer: { text: answer.expression, stressedVowels: [] },
      example: answer.examples[0],
    };
    const round = {
      form: 'chips',
      chipKind: 'word',
      prompt: answer.primaryDefinition,
      expected: words,
      sheet,
    } as const;
    if (!edition.isFeatureEnabled('buildIdiomCheck')) {
      return { ...round, chips: outOfOrder(words, shuffled(words, random), comparison) };
    }
    const others = eligible.flatMap((entry: AskableEntry) =>
      entry.kind === 'idiom' && entry.id !== answer.id && entry.idiomType !== 'placeName'
        ? [wordsOf(entry.expression, punctuation)]
        : [],
    );
    const decoys = decoysFor(words, others, random, comparison);
    if (decoys === undefined) return undefined;
    return {
      ...round,
      layout: 'field',
      chips: outOfOrder(words, shuffled([...words, ...decoys], random), comparison),
    };
  },
};
