import type { EditionStrings } from '@slovo/contracts';
import type { CurrentGame, Haptics } from '@slovo/core';
import { EditionProvider, GameRound, HapticsProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const strings = {
  game: {
    round: {
      progress: '{passed} / {total}',
      progressLabel: 'Rounds passed: {passed} of {total}',
      lives: 'Lives: {count} of {total}',
      highlight: 'Marked: {text}',
      correct: 'Right',
      chosen: 'Your choice',
      synonymRow: { label: 'Synonyms', prompt: 'What is a synonym of “{dominant}”?' },
      tip: { label: 'Tip' },
    },
    exit: {
      label: 'Leave the Game',
      title: 'Leave?',
      message: 'The Game ends.',
      confirm: 'Leave',
      cancel: 'Play on',
    },
    sheet: { correct: 'Right!', wrong: 'Not this time', next: 'Next' },
  },
  wordCard: {
    stress: 'stress on {vowels}',
    stressOr: 'or',
    example: '{text}',
    exampleAuthor: '{author}',
  },
} as unknown as EditionStrings;

/** A screen with no insets, so the sheet needn't wait for the device's. */
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const OPTIONS = ['ardent', 'brittle', 'candid', 'dour'] as const;
/** The place of the right option. */
const CORRECT = 2;

const first: CurrentGame = {
  modeId: 'definition-to-word',
  round: {
    number: 1,
    entryKind: 'word',
    prompt: 'open and honest',
    highlight: undefined,
    options: OPTIONS.map((text) => ({ text, stressedVowels: [] })),
    answer: undefined,
  },
  roundsPassed: 0,
  lives: 5,
  played: [],
  status: 'playing',
};

/** The Game with its Round answered with the option at that place, as the Game in play answers it. */
function answered(game: CurrentGame, chosen: number): CurrentGame {
  return {
    ...game,
    round: {
      ...game.round,
      answer: {
        chosen,
        correct: CORRECT,
        sheet: { answer: { text: OPTIONS[CORRECT], stressedVowels: [] }, example: undefined },
      },
    },
    lives: chosen === CORRECT ? game.lives : game.lives - 1,
    status: 'answered',
  };
}

/** The first Round asking about a Synonym Row, the dominant its prompt, as the Core builds it. */
const rowRound: CurrentGame = {
  ...first,
  round: { ...first.round, entryKind: 'synonymRow', prompt: 'frank' },
};

/** The first Round asking a Tip its own question, a long one, as the Core builds it. */
const tipRound: CurrentGame = {
  ...first,
  round: {
    ...first.round,
    entryKind: 'tip',
    prompt:
      'Which of these words would you choose to describe a friend who always says what they think?',
  },
};

function Game({
  start,
  onAnswer,
  onLeave,
}: {
  start: CurrentGame;
  onAnswer: (option: number) => void;
  onLeave: () => void;
}) {
  const [game, setGame] = useState(start);
  return (
    <GameRound
      game={game}
      label="Definition"
      onAnswer={(option) => {
        onAnswer(option);
        setGame((shown) => answered(shown, option));
      }}
      onNext={jest.fn()}
      onLeave={onLeave}
    />
  );
}

async function renderRound(
  onAnswer: (option: number) => void = jest.fn(),
  onLeave: () => void = jest.fn(),
  start: CurrentGame = first,
) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <Game start={start} onAnswer={onAnswer} onLeave={onLeave} />
        </HapticsProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

describe('GameRound', () => {
  it('shows a right answer as right', async () => {
    await renderRound();

    await fireEvent.press(screen.getByRole('button', { name: 'candid' }));

    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.queryByText('Your choice')).toBeNull();
    expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
  });

  it('shows a wrong choice beside the right answer', async () => {
    await renderRound();

    await fireEvent.press(screen.getByRole('button', { name: 'brittle' }));

    expect(screen.getByRole('button', { name: 'brittle, Your choice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
  });

  it('takes one answer a Round: a second tap does not count', async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer);

    await fireEvent.press(screen.getByRole('button', { name: 'brittle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'dour' }));
    await fireEvent.press(screen.getByRole('button', { name: 'brittle, Your choice' }));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'brittle, Your choice' })).toBeTruthy();
  });

  it("asks a Synonym Row's question under its own label, and takes an answer", async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer, jest.fn(), rowRound);

    expect(screen.getByTestId('game-prompt')).toHaveAccessibleName(
      'Synonyms. What is a synonym of “frank”?',
    );
    expect(screen.getByText('What is a synonym of “frank”?')).toBeOnTheScreen();
    expect(screen.queryByText('Definition')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'candid' }));

    expect(onAnswer).toHaveBeenCalledWith(CORRECT);
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
  });

  it('asks a Tip its own question, whole however long, under its own label, and takes an answer', async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer, jest.fn(), tipRound);

    expect(screen.getByTestId('game-prompt')).toHaveAccessibleName(`Tip. ${tipRound.round.prompt}`);
    expect(screen.getByText(tipRound.round.prompt)).toBeOnTheScreen();
    expect(screen.queryByText('Definition')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'dour' }));

    expect(onAnswer).toHaveBeenCalledWith(3);
    expect(screen.getByRole('button', { name: 'dour, Your choice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
  });

  describe('leaving', () => {
    it('asks before it leaves, and shows no dialog until the ✕ is pressed', async () => {
      const onLeave = jest.fn();
      await renderRound(jest.fn(), onLeave);

      expect(screen.queryByText('Leave?')).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Leave the Game' }));

      expect(screen.getByText('Leave?')).toBeOnTheScreen();
      expect(screen.getByText('The Game ends.')).toBeOnTheScreen();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('leaves when the reader confirms, and closes the dialog', async () => {
      const onLeave = jest.fn();
      await renderRound(jest.fn(), onLeave);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave the Game' }));

      await fireEvent.press(screen.getByTestId('game-exit-dialog-destructive'));

      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Leave?')).not.toBeOnTheScreen();
    });

    it('plays on when the reader cancels, and closes the dialog', async () => {
      const onLeave = jest.fn();
      await renderRound(jest.fn(), onLeave);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave the Game' }));

      await fireEvent.press(screen.getByTestId('game-exit-dialog-cancel'));

      expect(onLeave).not.toHaveBeenCalled();
      expect(screen.queryByText('Leave?')).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'candid' })).toBeOnTheScreen();
    });
  });
});
