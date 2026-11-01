import type { Correction, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import type { PlayedRound, RoundAnswer } from '@slovo/core';
import { EditionProvider, GameReview } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    review: {
      title: 'Your Rounds',
      right: 'right',
      wrong: 'wrong',
      picked: 'you picked {text}',
      typed: 'you typed {text}',
      withAnswer: '{title} — {answer}',
      expandHint: 'Shows what it means',
      openHint: 'Opens the entry',
    },
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
    { shown: option('candid'), gone: true },
    { shown: option('dour'), gone: false },
  ],
  definitions: [
    { shown: 'open and honest', gone: true },
    { shown: 'stern and gloomy', gone: false },
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

async function renderReview({
  onOpen = jest.fn(),
  played = rounds,
}: { onOpen?: (entryId: string) => void; played?: readonly PlayedRound[] } = {}) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <GameReview rounds={played} onOpen={onOpen} />
    </EditionProvider>,
  );
}

describe('GameReview', () => {
  it('lists every Round in order, right or wrong, with the wrong pick', async () => {
    await renderReview();

    expect(screen.getByRole('header', { name: 'Your Rounds' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toEqual(
      [
        '1, candid, right',
        '2, dour, wrong, you picked brittle',
        '3, in the meantimes, wrong, you picked in the meanwhiles',
        '4, spill the beans, wrong, you picked bite the dust',
        '5, walk, stress on a, wrong, you picked run, stress on u',
        '6, What time is it?, wrong, you picked How many hours?',
      ].map((name) => screen.getByRole('button', { name })),
    );
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent(/✓/);
    expect(screen.getByTestId('game-review-row-2')).toHaveTextContent(/✗/);
    expect(screen.getByText('you picked brittle')).toBeTruthy();
    expect(screen.queryByText('open and honest')).toBeNull();
  });

  it('expands a Word on a tap: its Definition, Example and etymology', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-1'));

    expect(screen.getByRole('button', { name: '1, candid, right', expanded: true })).toBeTruthy();
    expect(screen.getByText('open and honest')).toBeTruthy();
    expect(screen.getByText('“a candid talk”')).toBeTruthy();
    expect(screen.getByText('— Austen')).toBeTruthy();
    expect(screen.getByText('Etymology')).toBeTruthy();
    expect(screen.getByText('from Latin candidus, white')).toBeTruthy();
  });

  it('expands a Word without an Example or etymology to its Definition alone', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-2'));

    expect(screen.getByText('stern and gloomy')).toBeTruthy();
    expect(screen.queryByText('Etymology')).toBeNull();
  });

  it('expands a Correction on a tap: the right form and the explanation', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-3'));

    expect(screen.getByText('Better')).toBeTruthy();
    expect(screen.getByText('in the meantime')).toBeTruthy();
    expect(screen.getByText('The phrase takes the singular.')).toBeTruthy();
  });

  it('expands an idiom on a tap: its Definition, Example and origin', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-4'));

    expect(
      screen.getByRole('button', {
        name: '4, spill the beans, wrong, you picked bite the dust',
        expanded: true,
      }),
    ).toBeTruthy();
    expect(screen.getByText('to give away a secret')).toBeTruthy();
    expect(screen.getByText('“Who spilled the beans?”')).toBeTruthy();
    expect(screen.getByText('Origin')).toBeTruthy();
    expect(screen.getByText('from voting with beans in ancient Greece')).toBeTruthy();
    expect(screen.queryByText('Etymology')).toBeNull();
  });

  it('expands a Synonym Row on a tap: its members with their Stress', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-5'));

    expect(
      screen.getByRole('button', {
        name: '5, walk, stress on a, wrong, you picked run, stress on u',
        expanded: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('stro\u0301ll, a\u0301mble, stri\u0301de, hi\u0301ke, tru\u0301dge'),
    ).toBeTruthy();
  });

  it('expands a Tip on a tap: its explanation', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-6'));

    expect(
      screen.getByRole('button', {
        name: '6, What time is it?, wrong, you picked How many hours?',
        expanded: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('Ask for the hour with «what time», not «how much time».'),
    ).toBeTruthy();
  });

  it('opens the Entry on a second tap, and keeps one Round expanded at a time', async () => {
    const onOpen = jest.fn();
    await renderReview({ onOpen });

    await fireEvent.press(screen.getByTestId('game-review-row-1'));
    expect(onOpen).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('game-review-row-2'));
    expect(screen.queryByText('open and honest')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('game-review-row-2'));

    await fireEvent.press(screen.getByTestId('game-review-row-4'));
    await fireEvent.press(screen.getByTestId('game-review-row-4'));

    expect(onOpen.mock.calls).toEqual([['w_dour'], ['i_spillthebeans']]);
  });

  it('opens a Synonym Row and a Tip on a second tap', async () => {
    const onOpen = jest.fn();
    await renderReview({ onOpen });

    await fireEvent.press(screen.getByTestId('game-review-row-5'));
    expect(onOpen).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('game-review-row-5'));
    await fireEvent.press(screen.getByTestId('game-review-row-6'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('game-review-row-6'));

    expect(onOpen.mock.calls).toEqual([['r_walk'], ['t_whattime']]);
  });
  it("lists a Round of every answer form, right or wrong, with the reader's answer on a mistake", async () => {
    await renderReview({ played: formRounds });

    expect(screen.getAllByRole('button')).toEqual(
      [
        '1, record, stress on e, right',
        '2, record, stress on e, wrong, you picked record, stress on o',
        '3, candid, right',
        '4, dour, wrong, you picked open and honest',
        '5, dour, right',
        '6, dour, wrong, you picked duor',
        '7, spill the beans, right',
        '8, spill the beans, wrong, you picked beans the spill',
        '9, in the meantimes, right',
        '10, candid, wrong, you typed candit',
      ].map((name) => screen.getByRole('button', { name })),
    );
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent('1re\u0301cord✓');
    expect(screen.getByTestId('game-review-row-2')).toHaveTextContent(
      '2re\u0301cordyou picked reco\u0301rd✗',
    );
    expect(screen.getByTestId('game-review-row-4')).toHaveTextContent(
      '4douryou picked open and honest✗',
    );
    expect(screen.getByTestId('game-review-row-6')).toHaveTextContent('6douryou picked duor✗');
    expect(screen.getByTestId('game-review-row-7')).toHaveTextContent('7spill the beans✓');
    expect(screen.getByTestId('game-review-row-8')).toHaveTextContent(
      '8spill the beansyou picked beans the spill✗',
    );
    expect(screen.getByTestId('game-review-row-10')).toHaveTextContent('10candidyou typed candit✗');
  });

  it('leads a Round of the origin mode with the Word asked about, its right language beside it', async () => {
    await renderReview({ played: originRounds });

    expect(screen.getAllByRole('button')).toEqual(
      ['1, record, stress on e — Latin, right', '2, candid — Latin, wrong, you picked Greek'].map(
        (name) => screen.getByRole('button', { name }),
      ),
    );
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent('1re\u0301cord — Latin✓');
    expect(screen.getByTestId('game-review-row-2')).toHaveTextContent(
      '2candid — Latinyou picked Greek✗',
    );
  });

  it('expands a Round of any answer form and opens its Entry on a second tap', async () => {
    const onOpen = jest.fn();
    await renderReview({ onOpen, played: formRounds });

    await fireEvent.press(screen.getByTestId('game-review-row-4'));
    expect(screen.getByText('stern and gloomy')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-review-row-4'));
    await fireEvent.press(screen.getByTestId('game-review-row-8'));
    expect(screen.getByText('to give away a secret')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-review-row-8'));
    await fireEvent.press(screen.getByTestId('game-review-row-9'));
    expect(screen.getByText('The phrase takes the singular.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('game-review-row-9'));

    expect(onOpen.mock.calls).toEqual([['w_dour'], ['i_spillthebeans'], ['c_meanwhile']]);
  });
});
