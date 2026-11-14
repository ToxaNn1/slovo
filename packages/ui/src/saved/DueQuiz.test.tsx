import type { DueQuestion, Haptics } from '@slovo/core';
import { DueQuizCard, DueQuizSheet, EditionProvider, HapticsProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  learning: {
    dueQuiz: {
      title: 'Check yourself',
      count: { one: '{count} word today', other: '{count} words today' },
      start: 'Start',
      cardLabel: 'Check yourself, {count}',
      progress: '{index} of {count}',
      question: 'What does it mean?',
      options: { first: 'A', second: 'B', third: 'C' },
      optionLabel: '{option}, {meaning}',
      answered: { right: 'Right', wrong: 'Wrong' },
      next: 'Next',
      done: 'Done',
      cancel: 'Cancel',
      result: {
        allRight: {
          single: 'Spot on: you know it.',
          both: 'Spot on: you know both.',
          many: { one: 'Spot on: all {count}.', other: 'Spot on: all {count}.' },
        },
        partial: 'Checked: {known} of {count}.',
      },
    },
  },
  game: { round: { correct: 'Right one', chosen: 'Your pick' } },
});

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

/** Two Words due: the right meaning second, then first. */
const questions: readonly DueQuestion[] = [
  { wordId: 'w1', lemma: 'meek', meanings: ['A cloud.', 'Quiet and gentle.', 'A coin.'], right: 1 },
  { wordId: 'w2', lemma: 'gaunt', meanings: ['Lean and haggard.', 'A bird.', 'A song.'], right: 0 },
];

async function renderInEdition(element: ReactElement) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>{element}</HapticsProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

async function renderSheet(asked: readonly DueQuestion[] = questions) {
  const onAnswer = jest.fn();
  const onDone = jest.fn();
  const onClose = jest.fn();
  await renderInEdition(
    <DueQuizSheet
      visible
      questions={asked}
      onAnswer={onAnswer}
      onDone={onDone}
      onClose={onClose}
    />,
  );
  return { onAnswer, onDone, onClose };
}

describe('DueQuizCard', () => {
  it('says how many Words it asks today and starts on «Start»', async () => {
    const onStart = jest.fn();
    await renderInEdition(<DueQuizCard count={3} onStart={onStart} />);

    expect(screen.getByLabelText('Check yourself, 3 words today')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('stands «Start» 48 tall, as the board does', async () => {
    await renderInEdition(<DueQuizCard count={3} onStart={jest.fn()} />);

    expect(screen.getByTestId('due-quiz-start-face')).toHaveStyle({ minHeight: 48 });
  });
});

describe('DueQuizSheet', () => {
  it('asks the first Word: its place, its Lemma, the question and three meanings', async () => {
    await renderSheet();

    expect(screen.getByText('1 of 2')).toBeVisible();
    expect(screen.getByRole('header', { name: 'Meek' })).toBeVisible();
    expect(screen.getByText('What does it mean?')).toBeVisible();
    expect(screen.getByLabelText('A, A cloud.')).toBeVisible();
    expect(screen.getByLabelText('B, Quiet and gentle.')).toBeVisible();
    expect(screen.getByLabelText('C, A coin.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('takes the first pick as the answer and lights the right meaning', async () => {
    const { onAnswer } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('B, Quiet and gentle.'));
    await fireEvent.press(screen.getByLabelText('A, A cloud.'));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(questions[0], 1);
    expect(screen.getByTestId('due-quiz-option-1-check')).toBeTruthy();
    expect(screen.queryByTestId('due-quiz-option-0-cross')).toBeNull();
  });

  it('strikes a wrong pick and lights the right one too', async () => {
    const { onAnswer } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('A, A cloud.'));

    expect(onAnswer).toHaveBeenCalledWith(questions[0], 0);
    expect(screen.getByTestId('due-quiz-option-0-cross')).toBeTruthy();
    expect(screen.getByTestId('due-quiz-option-1-check')).toBeTruthy();
  });

  it('keeps the answer in the options for VoiceOver, each disabled once picked', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByLabelText('A, A cloud.'));

    expect(screen.getByTestId('due-quiz-option-0')).toHaveAccessibleName('A, A cloud., Your pick');
    expect(screen.getByTestId('due-quiz-option-1')).toHaveAccessibleName(
      'B, Quiet and gentle., Right one',
    );
    expect(screen.getByTestId('due-quiz-option-2')).toHaveAccessibleName('C, A coin.');
    for (const option of [0, 1, 2])
      expect(screen.getByTestId(`due-quiz-option-${String(option)}`)).toBeDisabled();
  });

  it('moves on with «Next» and ends with «Done», telling how many were right', async () => {
    const { onDone } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('A, A cloud.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 of 2')).toBeVisible();
    expect(screen.getByRole('header', { name: 'Gaunt' })).toBeVisible();

    await fireEvent.press(screen.getByLabelText('A, Lean and haggard.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(onDone).toHaveBeenCalledWith('Checked: 1 of 2.');
  });

  it('praises every answer right', async () => {
    const { onDone } = await renderSheet(questions.slice(0, 1));

    await fireEvent.press(screen.getByLabelText('B, Quiet and gentle.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(onDone).toHaveBeenCalledWith('Spot on: you know it.');
  });

  it('closes on «Cancel»', async () => {
    const { onClose, onDone } = await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
