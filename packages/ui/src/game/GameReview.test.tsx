import type { Correction, EditionStrings, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import type { PlayedRound } from '@slovo/core';
import { EditionProvider, GameReview } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

const strings = {
  game: {
    review: {
      title: 'Your Rounds',
      right: 'right',
      wrong: 'wrong',
      picked: 'you picked {text}',
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
} as unknown as EditionStrings;

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

/** A Round of the Game over, asked about `entry`, with the reader's pick among four options. */
function played(
  number: number,
  entry: Word | Correction | Idiom | SynonymRow | Tip,
  answer: string,
  chosen: string,
): PlayedRound {
  const texts = [answer, chosen === answer ? 'other' : chosen, 'third', 'fourth'];
  const options = texts.map((text) => ({ text, stressedVowels: [] }));
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

async function renderReview({ onOpen = jest.fn() }: { onOpen?: (entryId: string) => void } = {}) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <GameReview rounds={rounds} onOpen={onOpen} />
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
        '5, walk, stress on a, wrong, you picked ru\u0301n',
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
        name: '5, walk, stress on a, wrong, you picked ru\u0301n',
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
});
