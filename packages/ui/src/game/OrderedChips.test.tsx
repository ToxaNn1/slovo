import type { EditionStrings } from '@slovo/contracts';
import type { FixedChip, RoundAnswer } from '@slovo/core';
import { EditionProvider, OrderedChips } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

type ChipsAnswer = Extract<RoundAnswer, { form: 'chips' }>;

const strings = {} as unknown as EditionStrings;

/** «obrok» as shuffled letters, and the letters in the right order. */
const LETTERS = ['k', 'o', 'r', 'b', 'o'] as const;
const WORD = ['o', 'b', 'r', 'o', 'k'] as const;

/** The chips tapped, judged as the Game in play judges them, equal chips interchangeable. */
function judged(chips: readonly string[], expected: readonly string[], chosen: number[]) {
  const right = chosen.every((place, index) => chips[place] === expected[index]);
  return {
    form: 'chips',
    chosen,
    expected,
    right,
    sheet: { answer: { text: expected.join(''), stressedVowels: [] }, example: undefined },
  } satisfies ChipsAnswer;
}

function Round({
  chips,
  expected,
  kind,
  fixed,
  onAnswer,
}: {
  chips: readonly string[];
  expected: readonly string[];
  kind: 'letter' | 'word';
  fixed: readonly FixedChip[] | undefined;
  onAnswer: (chosen: number[]) => void;
}) {
  const [answer, setAnswer] = useState<ChipsAnswer>();
  return (
    <OrderedChips
      chips={chips}
      kind={kind}
      fixed={fixed}
      answer={answer}
      onAnswer={(chosen) => {
        onAnswer(chosen);
        setAnswer(judged(chips, expected, chosen));
      }}
    />
  );
}

async function renderChips({
  chips = LETTERS,
  expected = WORD,
  kind = 'letter',
  fixed,
  onAnswer = jest.fn(),
}: {
  chips?: readonly string[];
  expected?: readonly string[];
  kind?: 'letter' | 'word';
  fixed?: readonly FixedChip[];
  onAnswer?: (chosen: number[]) => void;
} = {}) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <Round chips={chips} expected={expected} kind={kind} fixed={fixed} onAnswer={onAnswer} />
    </EditionProvider>,
  );
}

const lineText = () =>
  screen
    .queryAllByTestId(/^chips-line-\d+$/)
    .map((chip) => chip.props['accessibilityLabel'] as string);

async function tap(...places: number[]) {
  for (const place of places) await fireEvent.press(screen.getByTestId(`chips-${String(place)}`));
}

/** The horizontal shift of the chip at that place in the answer line. */
function shiftOf(index: number): number {
  const style = getAnimatedStyle(screen.getByTestId(`chips-line-${String(index)}`)) as {
    transform?: { translateX?: number }[];
  };
  return style.transform?.find((step) => step.translateX !== undefined)?.translateX ?? 0;
}

describe('OrderedChips', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reduce Motion off, whatever a test before turned on.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fills the answer line with the chips in the order tapped', async () => {
    await renderChips();

    await tap(1, 3);

    expect(lineText()).toEqual(['o', 'b']);
    // A placed chip leaves its place empty, which VoiceOver skips.
    expect(screen.getByTestId('chips-1', { includeHiddenElements: true })).toBeDisabled();
    expect(screen.queryByTestId('chips-1')).toBeNull();
    expect(screen.getByTestId('chips-0')).toBeEnabled();
  });

  it('puts a chip tapped in the line back among the chips', async () => {
    await renderChips();
    await tap(1, 3, 2);

    await fireEvent.press(screen.getByTestId('chips-line-1'));

    expect(lineText()).toEqual(['o', 'r']);
    expect(screen.getByTestId('chips-3')).toBeEnabled();
  });

  it('gives the answer with the last chip, the chips in the order tapped', async () => {
    const onAnswer = jest.fn();
    await renderChips({ onAnswer });

    await tap(1, 3, 2, 4);
    expect(onAnswer).not.toHaveBeenCalled();
    await tap(0);

    expect(onAnswer).toHaveBeenCalledWith([1, 3, 2, 4, 0]);
    expect(lineText()).toEqual(['o', 'b', 'r', 'o', 'k']);
    expect(screen.getByTestId('chips-line-0')).toBeDisabled();
  });

  it('shakes the first wrong chip of a wrong answer', async () => {
    await renderChips();

    // o, r where b belongs, then the rest.
    await tap(1, 2, 3, 4, 0);
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(shiftOf(1)).toBe(-4);
    expect(shiftOf(0)).toBe(0);
    expect(shiftOf(2)).toBe(0);
    await act(() => {
      jest.advanceTimersByTime(240);
    });
    expect(shiftOf(1)).toBe(0);
  });

  it('shakes nothing in a right answer', async () => {
    await renderChips();

    // The two o chips are interchangeable.
    await tap(4, 3, 2, 1, 0);
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect([0, 1, 2, 3, 4].map(shiftOf)).toEqual([0, 0, 0, 0, 0]);
  });

  it('shakes no chip with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderChips();

    await tap(1, 2, 3, 4, 0);
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(shiftOf(1)).toBe(0);
  });

  it('names each chip for VoiceOver by its letter, in the line as among the chips', async () => {
    await renderChips();
    await tap(1);

    expect(screen.getByRole('button', { name: 'k' })).toBeEnabled();
    expect(screen.getByTestId('chips-line-0')).toHaveAccessibleName('o');
    expect(screen.getAllByRole('button', { name: 'o' })).toHaveLength(2);
  });

  it('keeps an apostrophe in its place in the line, after the chips before it, and never a chip', async () => {
    // «p'yat» as shuffled letters, its apostrophe after the first letter.
    await renderChips({
      chips: ['t', 'y', 'p', 'a'],
      expected: ['p', 'y', 'a', 't'],
      fixed: [{ at: 1, text: "'" }],
    });

    expect(screen.queryByText("'")).toBeNull();
    expect(screen.queryAllByTestId(/^chips-\d+$/)).toHaveLength(4);
    await tap(2);
    expect(screen.getByTestId('chips-line')).toHaveTextContent("p'", { exact: false });
    await tap(1, 3, 0);

    expect(screen.getByTestId('chips-line')).toHaveTextContent("p'yat");
    expect(lineText()).toEqual(['p', 'y', 'a', 't']);
  });

  it('plays words as chips the same way', async () => {
    const onAnswer = jest.fn();
    await renderChips({
      chips: ['tail', 'the', 'wag', 'dog'],
      expected: ['the', 'tail', 'wag', 'dog'],
      kind: 'word',
      onAnswer,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'the' }));
    await fireEvent.press(screen.getByRole('button', { name: 'tail' }));

    expect(lineText()).toEqual(['the', 'tail']);
  });

  it('shakes the first word out of place in a wrong expression', async () => {
    await renderChips({
      chips: ['tail', 'the', 'wag', 'dog'],
      expected: ['the', 'tail', 'wag', 'dog'],
      kind: 'word',
    });

    // «tail» where «the» belongs, then the rest.
    await tap(0, 1, 2, 3);
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(shiftOf(0)).toBe(-4);
    expect([1, 2, 3].map(shiftOf)).toEqual([0, 0, 0]);
  });
});
