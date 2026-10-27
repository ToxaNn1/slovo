import { outOfOrder, shuffled, type GameMode } from './game-mode';

/** How many words an expression that plays has, at least and at most. */
const WORDS = { min: 2, max: 8 } as const;

/**
 * «Склади вислів», the Core's expression-building mode (ADR 0052), on while
 * the Edition turns Idioms on: a Round shows an idiom's or a proverb's
 * primary Definition and the words of its expression as shuffled chips,
 * tapped in order, compared ignoring case; equal words are interchangeable.
 * The Edition's expression punctuation, such as a comma or a dash, is no
 * chip and no part of one; a hyphen inside a word stays. Only expressions of
 * 2–8 words play, and a place name never does (ADR 0046). Its sheet shows
 * the whole expression and the Idiom's first Example, if it has one.
 */
export const buildIdiomMode: GameMode = {
  id: 'build-idiom',
  entryKind: 'idiom',
  isOn: (edition) =>
    edition.isFeatureEnabled('gameBuildIdiom') && edition.isFeatureEnabled('idioms'),
  buildRound({ answer, random, edition }) {
    if (answer.kind !== 'idiom' || answer.idiomType === 'placeName') return undefined;
    const punctuation = new Set(edition.languageTraits.expressionPunctuation ?? []);
    const words = answer.expression
      .split(' ')
      .map((word) =>
        Array.from(word, (character) => (punctuation.has(character) ? '' : character)).join(''),
      )
      .filter((word) => word !== '');
    if (words.length < WORDS.min || words.length > WORDS.max) return undefined;
    return {
      form: 'chips',
      prompt: answer.primaryDefinition,
      chips: outOfOrder(words, shuffled(words, random)),
      expected: words,
      sheet: {
        answer: { text: answer.expression, stressedVowels: [] },
        example: answer.examples[0],
      },
    };
  },
};
