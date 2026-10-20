import type { Correction, EditionStrings, Word } from '@slovo/contracts';
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

/** A Round of the Game over, asked about `entry`, with the reader's pick among four options. */
function played(
  number: number,
  entry: Word | Correction,
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
    prompt: entry.kind === 'word' ? entry.primaryDefinition : entry.nonStandardForm,
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
    expect(
      screen.getAllByRole('button').map((row) => row.props['accessibilityLabel'] as string),
    ).toEqual([
      '1, candid, right',
      '2, dour, wrong, you picked brittle',
      '3, in the meantimes, wrong, you picked in the meanwhiles',
    ]);
    expect(screen.getByTestId('game-review-row-1')).toHaveTextContent(/✓/);
    expect(screen.getByTestId('game-review-row-2')).toHaveTextContent(/✗/);
    expect(screen.getByText('you picked brittle')).toBeTruthy();
    expect(screen.queryByText('open and honest')).toBeNull();
  });

  it('expands a Word on a tap: its Definition, Example and etymology', async () => {
    await renderReview();

    await fireEvent.press(screen.getByTestId('game-review-row-1'));

    expect(screen.getByTestId('game-review-row-1')).toHaveProp('accessibilityState', {
      expanded: true,
    });
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

  it('opens the Entry on a second tap, and keeps one Round expanded at a time', async () => {
    const onOpen = jest.fn();
    await renderReview({ onOpen });

    await fireEvent.press(screen.getByTestId('game-review-row-1'));
    expect(onOpen).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('game-review-row-2'));
    expect(screen.queryByText('open and honest')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('game-review-row-2'));

    expect(onOpen.mock.calls).toEqual([['w_dour']]);
  });
});
