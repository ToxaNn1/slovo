import type { Correction, EditionStrings, Idiom, Word } from '@slovo/contracts';
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
  sources: [],
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

/** A Round of the Game over, asked about `entry`, with the reader's pick among four options. */
function played(
  number: number,
  entry: Word | Correction | Idiom,
  answer: string,
  chosen: string,
): PlayedRound {
  const texts = [answer, chosen === answer ? 'other' : chosen, 'third', 'fourth'];
  const options = texts.map((text) => ({ text, stressedVowels: [] }));
  const roundAnswer = {
    chosen: texts.indexOf(chosen),
    correct: 0,
    sheet: { answer: { text: answer, stressedVowels: [] }, example: undefined },
  };
  return {
    number,
    prompt: entry.kind === 'correction' ? entry.nonStandardForm : entry.primaryDefinition,
    highlight: undefined,
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
});
