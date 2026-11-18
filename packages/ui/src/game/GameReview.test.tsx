import type { Correction, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import type { PlayedRound, RoundAnswer } from '@slovo/core';
import { EditionProvider, GameReview } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    review: { right: 'right', wrong: 'wrong' },
    finals: { review: 'Round review' },
  },
  wordCard: {
    stress: 'stress on {vowels}',
    stressOr: 'or',
    example: '“{text}”',
    exampleAuthor: '— {author}',
    etymology: 'Etymology',
  },
  correctionCard: { standard: 'Better' },
  idiomCard: { etymology: 'Origin' },
});

const candid: Word = {
  kind: 'word',
  id: 'w_candid',
  lemma: 'candid',
  stress: [],
  partOfSpeech: 'adjective',
  primaryDefinition: 'open and honest',
  extraDefinitions: [],
  examples: [{ text: 'a candid talk', author: 'Austen' }],
  synonyms: [],
  antonyms: [],
  etymology: 'from Latin candidus, white',
  registers: [],
  categoryId: 'character',
  rarity: 3,
  sources: [],
  correctionIds: [],
  retired: false,
};

const dour: Word = {
  ...candid,
  id: 'w_dour',
  lemma: 'dour',
  primaryDefinition: 'stern and gloomy',
  examples: [],
  etymology: undefined,
};

const correction: Correction = {
  kind: 'correction',
  id: 'c_meanwhile',
  nonStandardForm: 'in the meantimes',
  correctionType: 'calque',
  standardEquivalents: ['in the meantime', 'meanwhile'],
  explanation: 'The phrase takes the singular.',
  examplePair: { nonStandard: 'in the meantimes', standard: 'in the meantime' },
  categoryId: 'everyday',
  sources: [],
  literaryUses: [],
  retired: false,
};

const spillTheBeans: Idiom = {
  kind: 'idiom',
  id: 'i_spillthebeans',
  expression: 'spill the beans',
  idiomType: 'idiom',
  primaryDefinition: 'to give away a secret',
  extraDefinitions: [],
  examples: [{ text: 'Who spilled the beans?' }],
  etymology: 'from voting with beans in ancient Greece',
  sources: [],
  retired: false,
};

const walk: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_walk',
  dominant: { text: 'walk', stress: [1] },
  meaning: 'to go on foot',
  members: [
    { text: 'stroll', stress: [3] },
    { text: 'amble', stress: [0] },
    { text: 'stride', stress: [3] },
    { text: 'hike', stress: [1] },
    { text: 'trudge', stress: [2] },
  ],
  sources: [],
  retired: false,
};

const whatTime: Tip = {
  kind: 'tip',
  id: 't_whattime',
  title: 'What time is it?',
  standardForm: 'What time is it?',
  explanation: 'Ask for the hour with «what time», not «how much time».',
  sources: [],
  gameQuestion: {
    prompt: 'How do you ask for the hour?',
    rightAnswer: 'What time is it?',
    wrongAnswers: ['How much time is it?', 'How many hours?', 'Which hour is it?'],
  },
  retired: false,
};

const option = (text: string, stressedVowels: readonly string[] = []) => ({ text, stressedVowels });

/** A Round of the Game over, asked about `entry`, with the reader's pick among four options. */
function played(
  number: number,
  entry: Word | Correction | Idiom | SynonymRow | Tip,
  answer: string,
  chosen: string,
): PlayedRound {
  const texts = [answer, chosen === answer ? 'other' : chosen, 'third', 'fourth'];
  // A stressed option names its stressed vowel, the letter before the mark.
  const options = texts.map((text) => option(text, /(.)\u0301/.exec(text)?.slice(1) ?? []));
  const roundAnswer = {
    form: 'pick' as const,
    chosen: texts.indexOf(chosen),
    correct: 0,
    right: chosen === answer,
    sheet: { answer: { text: answer, stressedVowels: [] }, example: undefined },
  };
  return {
    number,
    entryKind: entry.kind,
    prompt:
      entry.kind === 'correction'
        ? entry.nonStandardForm
        : entry.kind === 'synonymRow'
          ? 'wa\u0301lk'
          : entry.kind === 'tip'
            ? entry.gameQuestion.prompt
            : entry.primaryDefinition,
    highlight: undefined,
    gap: undefined,
    labelKind: 'mode',
    lifeLostAfter: 200,
    form: 'pick',
    options,
    answer: roundAnswer,
    entry,
    right: chosen === answer,
  };
}

const rounds = [
  played(1, candid, 'candid', 'candid'),
  played(2, dour, 'dour', 'brittle'),
  played(3, correction, 'in the meantime', 'in the meanwhiles'),
  played(4, spillTheBeans, 'spill the beans', 'bite the dust'),
  played(5, walk, 'stro\u0301ll', 'ru\u0301n'),
  played(6, whatTime, 'What time is it?', 'How many hours?'),
];

/** What a Round of the Game over has whatever its form, with its answer judged. */
const playedIn = (
  number: number,
  entry: Word | Correction | Idiom,
  prompt: string,
  answer: RoundAnswer,
) => ({
  number,
  entryKind: entry.kind,
  prompt,
  highlight: undefined,
  gap: undefined,
  labelKind: 'mode' as const,
  lifeLostAfter: 200,
  answer,
  entry,
  right: answer.right,
});

const sheetOf = (text: string, stressedVowels: readonly string[] = []) => ({
  answer: option(text, stressedVowels),
  example: undefined,
});

const record: Word = { ...candid, id: 'w_record', lemma: 'record', stress: [1] };

const vowels = { form: 'vowel' as const, vowels: [1, 3] };
const grid = {
  form: 'pairs' as const,
  words: [
    { shown: option('candid'), state: 'found' as const },
    { shown: option('dour'), state: 'open' as const },
  ],
  definitions: [
    { shown: 'open and honest', state: 'found' as const },
    { shown: 'stern and gloomy', state: 'open' as const },
  ],
};
const letters = {
  form: 'chips' as const,
  chipKind: 'letter' as const,
  chips: ['r', 'o', 'd', 'u'],
  fixed: [],
};
const words = {
  form: 'chips' as const,
  chipKind: 'word' as const,
  chips: ['beans', 'the', 'spill'],
  fixed: [],
};
const typed = { form: 'typed' as const, blanks: undefined, canOpenLetter: false as const };

/** Every answer form other than a pick, each answered right, then wrong. */
const formRounds: PlayedRound[] = [
  {
    ...playedIn(1, record, 'record', {
      form: 'vowel',
      chosen: 1,
      stressed: [1],
      right: true,
      sheet: sheetOf('re\u0301cord', ['e']),
    }),
    ...vowels,
  },
  {
    ...playedIn(2, record, 'record', {
      form: 'vowel',
      chosen: 3,
      stressed: [1],
      right: false,
      sheet: sheetOf('re\u0301cord', ['e']),
    }),
    ...vowels,
  },
  {
    ...playedIn(3, candid, '', {
      form: 'pairs',
      word: 0,
      definition: 0,
      correct: 0,
      right: true,
      sheet: sheetOf('candid'),
    }),
    ...grid,
  },
  {
    ...playedIn(4, dour, '', {
      form: 'pairs',
      word: 1,
      definition: 0,
      correct: 1,
      right: false,
      sheet: sheetOf('dour'),
    }),
    ...grid,
  },
  {
    ...playedIn(5, dour, 'stern and gloomy', {
      form: 'chips',
      chosen: [2, 1, 3, 0],
      expected: ['d', 'o', 'u', 'r'],
      right: true,
      sheet: sheetOf('dour'),
    }),
    ...letters,
  },
  {
    ...playedIn(6, dour, 'stern and gloomy', {
      form: 'chips',
      chosen: [2, 3, 1, 0],
      expected: ['d', 'o', 'u', 'r'],
      right: false,
      sheet: sheetOf('dour'),
    }),
    ...letters,
  },
  {
    ...playedIn(7, spillTheBeans, 'to give away a secret', {
      form: 'chips',
      chosen: [2, 1, 0],
      expected: ['spill', 'the', 'beans'],
      right: true,
      sheet: sheetOf('spill the beans'),
    }),
    ...words,
  },
  {
    ...playedIn(8, spillTheBeans, 'to give away a secret', {
      form: 'chips',
      chosen: [0, 1, 2],
      expected: ['spill', 'the', 'beans'],
      right: false,
      sheet: sheetOf('spill the beans'),
    }),
    ...words,
  },
  {
    ...playedIn(9, correction, 'We waited in the meantimes.', {
      form: 'typed',
      typed: 'In the meantime',
      expected: 'in the meantime',
      right: true,
      sheet: sheetOf('in the meantime'),
    }),
    ...typed,
  },
  {
    ...playedIn(10, candid, 'open and honest', {
      form: 'typed',
      typed: '  candit ',
      expected: 'candid',
      right: false,
      sheet: sheetOf('candid'),
    }),
    ...typed,
  },
];

/** Two Rounds of the origin mode, where the right answer is the language of the Word asked about. */
const originRounds: PlayedRound[] = [
  { ...played(1, record, 'Latin', 'Latin'), prompt: 're\u0301cord' },
  { ...played(2, candid, 'Latin', 'Greek'), prompt: 'candid' },
].map((round) => ({
  ...round,
  answer: {
    ...round.answer,
    sheet: {
      ...round.answer.sheet,
      asked: round.entry === record ? option('re\u0301cord', ['e']) : option('candid'),
    },
  },
}));

async function renderReview(played: readonly PlayedRound[] = rounds) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <GameReview rounds={played} />
    </EditionProvider>,
  );
}

/** What VoiceOver reads of each row, in order. */
const rowLabels = () =>
  screen.getAllByTestId(/^game-review-row-/).map((row) => String(row.props['accessibilityLabel']));

describe('GameReview', () => {
  it('lists every Round in order under its title: its number, its word and whether it was right', async () => {
    await renderReview();

    expect(screen.getByRole('header', { name: 'Round review' })).toBeTruthy();
    expect(rowLabels()).toEqual([
      '1, candid, right',
      '2, dour, wrong',
      '3, in the meantimes, wrong',
      '4, spill the beans, wrong',
      '5, walk, stress on a, wrong',
      '6, What time is it?, wrong',
    ]);
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent('✓candid');
    expect(screen.getByTestId('game-review-row-2')).toHaveTextContent('✗dour');
    expect(screen.queryByText(/brittle/)).toBeNull();
    expect(screen.queryByText('open and honest')).toBeNull();
  });

  it('leads a Round of every answer form with its word, stressed where the Round showed the Stress', async () => {
    await renderReview(formRounds);

    expect(rowLabels()).toEqual([
      '1, record, stress on e, right',
      '2, record, stress on e, wrong',
      '3, candid, right',
      '4, dour, wrong',
      '5, dour, right',
      '6, dour, wrong',
      '7, spill the beans, right',
      '8, spill the beans, wrong',
      '9, in the meantimes, right',
      '10, candid, wrong',
    ]);
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent('✓re\u0301cord');
    expect(screen.getByTestId('game-review-row-8')).toHaveTextContent('✗spill the beans');
  });

  it('leads a Round of the origin mode with the Word asked about, not its language', async () => {
    await renderReview(originRounds);

    expect(rowLabels()).toEqual(['1, record, stress on e, right', '2, candid, wrong']);
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent('✓re\u0301cord');
  });

  it('offers no row to tap', async () => {
    await renderReview();

    expect(screen.queryAllByRole('button')).toEqual([]);
  });
});
