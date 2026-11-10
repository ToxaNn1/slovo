import type { Tip } from '@slovo/contracts';
import type { GameOver, Haptics, PlayedRound } from '@slovo/core';
import { EditionProvider, GameResult, HapticsProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    result: {
      won: {
        title: 'Well done',
        line: { one: '{count} Round passed', other: '{count} Rounds passed' },
      },
      timeUp: { title: 'Time is up', line: 'This is what a minute held.' },
      right: { one: 'right answer', other: 'right answers' },
      rounds: { one: 'Round', other: 'Rounds' },
      best: { one: 'best', other: 'best' },
      again: 'Again',
      home: 'Home',
    },
    round: { passedLabel: 'Passed: {passed}' },
  },
});

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const tip: Tip = {
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

const texts = ['What time is it?', 'How much time is it?', 'How many hours?', 'Which hour is it?'];

/** A Round of the Game, asked about the Tip, answered right or wrong. */
function played(number: number, right: boolean): PlayedRound {
  return {
    number,
    entryKind: 'tip',
    prompt: tip.gameQuestion.prompt,
    highlight: undefined,
    gap: undefined,
    labelKind: 'mode',
    lifeLostAfter: 200,
    form: 'pick',
    options: texts.map((text) => ({ text, stressedVowels: [] })),
    answer: {
      form: 'pick',
      chosen: right ? 0 : 1,
      correct: 0,
      right,
      sheet: { answer: { text: texts[0] ?? '', stressedVowels: [] }, example: undefined },
    },
    entry: tip,
    right,
  };
}

const rounds = [played(1, true), played(2, false), played(3, false)];

/** A Game of «На час» that ran out of Rounds with its time still left: 3 Rounds passed, 1 right. */
const timedOutOfRounds: GameOver = {
  modeId: 'timed',
  round: rounds[2] ?? played(3, false),
  roundsPassed: 3,
  roundLimit: undefined,
  lives: undefined,
  livesAtStart: undefined,
  timeLimit: 60_000,
  time: { left: 20_000, endsAt: undefined },
  played: rounds,
  status: 'won',
  end: { kind: 'finished', onTarget: false, played: 3, right: 1, xp: 0, newBest: false },
};

describe('GameResult', () => {
  it('shows a timed Game that ran out of Rounds as a timed result, with its right answers', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <GameResult
            game={timedOutOfRounds}
            bestResult={1}
            onAgain={jest.fn()}
            onHome={jest.fn()}
            onOpenEntry={undefined}
          />
        </HapticsProvider>
      </EditionProvider>,
    );

    expect(screen.getByRole('header', { name: 'Time is up' })).toBeOnTheScreen();
    expect(screen.getByTestId('game-result-right')).toHaveTextContent('1', { exact: false });
    expect(screen.queryByTestId('game-result-rounds')).toBeNull();
  });
});
