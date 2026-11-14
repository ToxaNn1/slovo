import type { Haptics, WordCardModel, YesterdayQuiz } from '@slovo/core';
import {
  EditionProvider,
  HapticsProvider,
  ReduceMotionProvider,
  VerticalPager,
  YesterdayCard,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const strings = testStrings({
  feedNotices: {
    yesterday: { title: 'Remember yesterday’s word?', right: 'Spot on!', wrong: 'Almost.' },
  },
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or' },
  game: { round: { correct: 'Right', chosen: 'Your pick' } },
});

const word: WordCardModel = {
  kind: 'word',
  wordId: 'w1',
  lemma: 'meek',
  stressedVowels: [],
  partOfSpeech: 'noun',
  gender: undefined,
  primaryDefinition: 'Quiet and gentle.',
  example: undefined,
  synonyms: [],
  antonyms: [],
  registers: [],
  region: undefined,
  history: undefined,
  categoryId: 'k1',
  categoryName: undefined,
  details: undefined,
  linkedCorrections: [],
  synonymRow: undefined,
  sourceNames: [],
};

/** The right meaning second among the three. */
const quiz: YesterdayQuiz = {
  meanings: ['A storm cloud.', 'Quiet and gentle.', 'An old coin.'],
  right: 1,
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** The Feed's pages: the Yesterday card, then the next Entry's card behind it. */
const PAGES = ['yesterday', 'next'] as const;

async function renderFeed({
  given = quiz,
  reduceMotion = false,
}: { given?: YesterdayQuiz; reduceMotion?: boolean } = {}) {
  const onAnswer = jest.fn();
  await render(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={PAGES}
            onIndexChange={jest.fn()}
            renderPage={(page) =>
              page === 'yesterday' ? (
                <YesterdayCard word={word} quiz={given} onAnswer={onAnswer} />
              ) : (
                <Text>Next</Text>
              )
            }
          />
        </HapticsProvider>
      </EditionProvider>
    </ReduceMotionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
  return { onAnswer };
}

/** The shake and the pop an option's motion holds now. */
function motionOf(place: number): { translateX: number; scale: number } {
  const { transform } = getAnimatedStyle(
    screen.getByTestId(`yesterday-option-${String(place)}-motion`),
  ) as { transform: [{ translateX: number }, { scale: number }] };
  return { translateX: transform[0].translateX, scale: transform[1].scale };
}

/** Lets `ms` of the motion run, the frames on the faked timers. */
async function moveFor(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

const option = (meaning: string) => screen.getByRole('button', { name: meaning });
const verdict = () => screen.getByTestId('yesterday-verdict');

async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the Yesterday card', () => {
  it('asks about yesterday’s Word: its Lemma and three meanings, no verdict yet', async () => {
    await renderFeed();

    expect(screen.getByTestId('feed-notice-yesterday')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Remember yesterday’s word?' })).toBeTruthy();
    expect(screen.getByText('Meek')).toBeTruthy();
    for (const meaning of quiz.meanings) expect(option(meaning)).toBeTruthy();
    expect(verdict()).toHaveTextContent('');
  });

  it('lights a right pick with a check, says «Spot on!» and gives the answer', async () => {
    const { onAnswer } = await renderFeed();

    await fireEvent.press(option('Quiet and gentle.'));

    expect(onAnswer).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Quiet and gentle., Right' })).toBeTruthy();
    expect(screen.getByTestId('yesterday-option-1-check')).toBeTruthy();
    expect(verdict()).toHaveTextContent('Spot on!');
  });

  it('crosses a wrong pick, lights the right one a moment later and fades the rest', async () => {
    const { onAnswer } = await renderFeed();

    await fireEvent.press(option('A storm cloud.'));

    expect(onAnswer).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: 'A storm cloud., Your pick' })).toBeTruthy();
    expect(screen.getByTestId('yesterday-option-0-cross')).toBeTruthy();
    expect(verdict()).toHaveTextContent('Almost.');
    expect(screen.queryByTestId('yesterday-option-1-check')).toBeNull();
    expect(screen.getByTestId('yesterday-option-2-place')).toHaveStyle({ opacity: 0.5 });
    expect(screen.getByTestId('yesterday-option-0-place')).toHaveStyle({
      transform: [{ translateY: 3 }],
    });

    await pass(400);

    expect(screen.getByTestId('yesterday-option-1-check')).toBeTruthy();
  });

  it('clears the pick on a second tap, and gives only the first pick', async () => {
    const { onAnswer } = await renderFeed();

    await fireEvent.press(option('A storm cloud.'));
    await fireEvent.press(option('A storm cloud., Your pick'));

    expect(verdict()).toHaveTextContent('');
    expect(screen.queryByTestId('yesterday-option-0-cross')).toBeNull();
    await pass(400);
    expect(screen.queryByTestId('yesterday-option-1-check')).toBeNull();

    await fireEvent.press(option('Quiet and gentle.'));

    expect(verdict()).toHaveTextContent('Spot on!');
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('shows the pick an answered quiz keeps, and gives no answer again', async () => {
    const { onAnswer } = await renderFeed({ given: { ...quiz, answered: 2 } });

    expect(screen.getByTestId('yesterday-option-2-cross')).toBeTruthy();
    expect(screen.getByTestId('yesterday-option-1-check')).toBeTruthy();

    await fireEvent.press(option('An old coin., Your pick'));
    await fireEvent.press(option('Quiet and gentle.'));

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('shakes a wrong pick and pops the right one as it lights', async () => {
    await renderFeed();

    await fireEvent.press(option('A storm cloud.'));
    await moveFor(40);
    expect(motionOf(0).translateX).toBeLessThan(0);

    await moveFor(400);
    expect(motionOf(1).scale).toBeLessThan(1);
  });

  it('under Reduce Motion neither shakes nor pops', async () => {
    await renderFeed({ reduceMotion: true });

    await fireEvent.press(option('A storm cloud.'));
    await moveFor(40);
    expect(motionOf(0).translateX).toBe(0);

    await moveFor(400);
    expect(screen.getByTestId('yesterday-option-1-check')).toBeTruthy();
    expect(motionOf(1).scale).toBe(1);
  });
});
