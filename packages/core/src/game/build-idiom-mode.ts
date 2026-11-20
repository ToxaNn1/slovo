import { outOfOrder } from './chips-form';
import type { GameMode } from './game-mode';
import { shuffled } from '../shuffled';

/** How many words an expression that plays has, at least and at most. */
const WORDS = { min: 2, max: 8 } as const;

/** The words of an expression that are chips, in order: the Edition's expression punctuation dropped. */
const wordsOf = (expression: string, punctuation: ReadonlySet<string>): string[] =>
  expression
    .split(' ')
    .map((word) =>
      Array.from(word, (character) => (punctuation.has(character) ? '' : character)).join(''),
    )
    .filter((word) => word !== '');

/**
 * «Склади вислів», the Core's expression-building mode, on while
 * the Edition turns Idioms on: a Round shows an idiom's or a proverb's
 * primary Definition and the words of its expression as shuffled chips,
 * tapped in order, compared ignoring case; equal words are interchangeable.
 * The Edition's expression punctuation, such as a comma or a dash, is no
 * chip and no part of one; a hyphen inside a word stays. Only expressions of
 * 2–8 words play, and a place name never does. Its sheet shows
 * the whole expression and the Idiom's first Example, if it has one; the
 * last chip gives the answer.
 */
export const buildIdiomMode: GameMode = {
  id: 'build-idiom',
  group: 'new',
  entryKind: 'idiom',
  isOn: (edition) => edition.isFeatureEnabled('gameBuildIdiom'),
  buildRound({ answer, random, edition, comparison }) {
    if (answer.kind !== 'idiom' || answer.idiomType === 'placeName') return undefined;
    const punctuation = new Set(edition.languageTraits.expressionPunctuation ?? []);
    const words = wordsOf(answer.expression, punctuation);
    if (words.length < WORDS.min || words.length > WORDS.max) return undefined;
    const sheet = {
      answer: { text: answer.expression, stressedVowels: [] },
      example: answer.examples[0],
    };
    return {
      form: 'chips',
      chipKind: 'word',
      prompt: answer.primaryDefinition,
      expected: words,
      chips: outOfOrder(words, shuffled(words, random), comparison),
      sheet,
    };
  },
};
