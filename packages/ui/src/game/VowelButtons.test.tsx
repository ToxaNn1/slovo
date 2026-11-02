import type { RoundAnswer } from '@slovo/core';
import { coreTokens, EditionProvider, VowelButtons } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];

const texts = {
  vowelLabel: (letter: string, place: number) => `${letter}, ${ORDINALS[place] ?? ''} letter`,
  correct: 'Right',
  chosen: 'Your pick',
};

type VowelAnswer = Extract<RoundAnswer, { form: 'vowel' }>;

/** «ba-na-na» with its vowels where they stand; the second is stressed. */
const BANANA = { text: 'banana', vowels: [1, 3, 5] };

function answered(chosen: number, stressed: number[]): VowelAnswer {
  return {
    form: 'vowel',
    chosen,
    stressed,
    right: stressed.includes(chosen),
    sheet: { answer: { text: 'banána', stressedVowels: ['a'] }, example: undefined },
  };
}

function Vowels({
  text = BANANA.text,
  vowels = BANANA.vowels,
  answer,
  onAnswer = jest.fn(),
}: {
  text?: string;
  vowels?: number[];
  answer?: VowelAnswer;
  onAnswer?: (position: number) => void;
}) {
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
      <VowelButtons
        text={text}
        vowels={vowels}
        answer={answer}
        onAnswer={onAnswer}
        texts={texts}
        testID="vowels"
      />
    </EditionProvider>
  );
}

/** What VoiceOver reads for each button, in order. */
function labels(): unknown[] {
  return screen.getAllByRole('button').map((button): unknown => button.props['accessibilityLabel']);
}

describe('VowelButtons', () => {
  it('draws the whole word, its vowels as buttons that VoiceOver reads with their place', async () => {
    await render(<Vowels />);

    expect(screen.getByTestId('vowels')).toHaveTextContent('banana', { exact: true });
    expect(labels()).toEqual(['a, second letter', 'a, fourth letter', 'a, sixth letter']);
  });

  it('answers with where the vowel tapped stands', async () => {
    const onAnswer = jest.fn();
    await render(<Vowels onAnswer={onAnswer} />);

    await fireEvent.press(screen.getByRole('button', { name: 'a, fourth letter' }));

    expect(onAnswer).toHaveBeenCalledWith(3);
  });

  it('makes no consonant a button', async () => {
    const onAnswer = jest.fn();
    await render(<Vowels onAnswer={onAnswer} />);

    await fireEvent.press(screen.getByText('b', { includeHiddenElements: true }));

    expect(screen.queryByRole('button', { name: /^[bn],/ })).toBeNull();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('counts only letters for a vowel’s place, past an apostrophe or a hyphen', async () => {
    await render(<Vowels text="o'er-ate" vowels={[0, 2, 5, 7]} />);

    expect(labels()).toEqual([
      'o, first letter',
      'e, second letter',
      'a, fourth letter',
      'e, sixth letter',
    ]);
  });

  it('marks a right tap and takes no other once answered', async () => {
    const onAnswer = jest.fn();
    await render(<Vowels answer={answered(3, [3])} onAnswer={onAnswer} />);

    await fireEvent.press(screen.getByRole('button', { name: 'a, second letter' }));

    expect(screen.getByRole('button', { name: 'a, fourth letter, Right' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'a, second letter' })).toBeDisabled();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('marks a wrong tap as the pick and every stressed vowel as right', async () => {
    await render(<Vowels answer={answered(1, [3, 5])} />);

    expect(screen.getByRole('button', { name: 'a, second letter, Your pick' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'a, fourth letter, Right' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'a, sixth letter, Right' })).toBeOnTheScreen();
  });
});

describe('VowelButtons on the design’s tiles', () => {
  const { accent, surfaceSunken, tile } = coreTokens.colors.light;

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  async function settle(reduceMotion: boolean, node: ReactElement) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
    await render(node);
    await act(async () => {
      await Promise.resolve();
    });
    await act(() => {
      jest.advanceTimersByTime(1000);
    });
  }

  /** The tilt of a vowel's tile, in degrees, once it has moved. */
  function tilt(position: number): number {
    const style = getAnimatedStyle(screen.getByTestId(`vowels-${String(position)}-motion`)) as {
      transform: { rotate?: string }[];
    };
    const rotate = style.transform.find((step) => step.rotate !== undefined)?.rotate ?? '0deg';
    return Number.parseFloat(rotate);
  }

  it('rests every vowel on a tile before the answer', async () => {
    await settle(false, <Vowels />);

    for (const position of BANANA.vowels)
      expect(screen.getByTestId(`vowels-${String(position)}-face`)).toHaveStyle({
        backgroundColor: tile,
      });
  });

  it('turns a right vowel red and drops a wrong tap, sunken and tilted', async () => {
    await settle(false, <Vowels />);
    await render(<Vowels answer={answered(1, [3])} />);
    await act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('vowels-3-face')).toHaveStyle({ backgroundColor: accent });
    expect(screen.getByTestId('vowels-1-face')).toHaveStyle({ backgroundColor: surfaceSunken });
    expect(tilt(1)).toBeLessThan(0);
    expect(tilt(3)).toBe(0);
  });

  it('tilts no wrong tap with Reduce Motion, and still turns the right vowel red', async () => {
    await settle(true, <Vowels answer={answered(1, [3])} />);

    expect(screen.getByTestId('vowels-3-face')).toHaveStyle({ backgroundColor: accent });
    expect(screen.getByTestId('vowels-1-face')).toHaveStyle({ backgroundColor: surfaceSunken });
    expect(tilt(1)).toBe(0);
  });
});
