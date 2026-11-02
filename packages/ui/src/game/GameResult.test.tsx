import { coreDecor, type CurrentGame, type Decor, type Haptics } from '@slovo/core';
import { DecorProvider, EditionProvider, GameResult, HapticsProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    round: {
      progress: '{passed} / {total}',
      progressLabel: 'Rounds passed: {passed} of {total}',
      passed: 'Passed: {passed}',
      passedLabel: 'Rounds passed: {passed}',
    },
    result: {
      won: { title: 'Won!', line: { one: '{count} Round', other: '{count} Rounds' } },
      lost: { title: 'Lost', line: 'Try again' },
      timeUp: { title: 'Time is up', line: 'Well played' },
      right: { one: 'right', other: 'right' },
      rounds: { one: 'Round', other: 'Rounds' },
      lives: { one: 'Life', other: 'Lives' },
      best: { one: 'best', other: 'best' },
      again: 'Again',
      home: 'Home',
    },
  },
});

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** A victory illustration of three layers, each a square. */
const layer = { path: 'M0 0h4v4H0z', light: '#000', dark: '#fff' };
const decor: Decor = {
  ...coreDecor,
  victory: { illustration: { width: 4, height: 4, layers: [layer, layer, layer] } },
};

const won: CurrentGame = {
  modeId: 'definition-to-word',
  round: {
    number: 15,
    entryKind: 'word',
    prompt: 'open and honest',
    highlight: undefined,
    gap: undefined,
    labelKind: 'mode',
    lifeLostAfter: 200,
    form: 'pick',
    options: [{ text: 'candid', stressedVowels: [] }],
    answer: undefined,
  },
  roundsPassed: 15,
  roundLimit: 15,
  lives: 3,
  livesAtStart: 5,
  played: [],
  status: 'won',
};

async function renderResult() {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <DecorProvider decor={decor}>
        <HapticsProvider haptics={haptics}>
          <GameResult
            game={won}
            bestResult={15}
            onAgain={jest.fn()}
            onHome={jest.fn()}
            onOpenEntry={undefined}
          />
        </HapticsProvider>
      </DecorProvider>
    </EditionProvider>,
  );
}

/** How far the victory illustration's layer at that place has come in: its opacity and its scale. */
function layerAt(index: number) {
  const style = getAnimatedStyle(
    screen.getByTestId(`victory-layer-${String(index)}`, { includeHiddenElements: true }),
  ) as {
    opacity?: number;
    transform?: { scale?: number }[];
  };
  return {
    opacity: style.opacity,
    scale: style.transform?.find((step) => step.scale !== undefined)?.scale ?? 1,
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('GameResult', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stitches in each layer of the victory illustration in 300 ms, 120 ms after the one before', async () => {
    await renderResult();

    // The last layer starts 240 ms late.
    await wait(240);
    expect(layerAt(2)).toEqual({ opacity: 0, scale: 0.6 });
    await wait(150);
    expect(layerAt(2).scale).not.toBe(1);
    await wait(150);

    expect([0, 1, 2].map(layerAt)).toEqual([
      { opacity: 1, scale: 1 },
      { opacity: 1, scale: 1 },
      { opacity: 1, scale: 1 },
    ]);
  });

  it('fades the layers in together in 250 ms with Reduce Motion, growing none', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderResult();

    await wait(100);
    expect(layerAt(2).opacity).toBeGreaterThan(0);
    expect(layerAt(2).scale).toBe(1);
    await wait(150);

    expect([0, 1, 2].map(layerAt)).toEqual([
      { opacity: 1, scale: 1 },
      { opacity: 1, scale: 1 },
      { opacity: 1, scale: 1 },
    ]);
  });
});
