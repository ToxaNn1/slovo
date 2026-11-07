import type { FixedChip, RoundAnswer } from '@slovo/core';
import { coreTokens, EditionProvider, OrderedChips } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

type ChipsAnswer = Extract<RoundAnswer, { form: 'chips' }>;

const strings = testStrings({});

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
  tiles,
  eraseLabel,
  onAnswer,
}: {
  chips: readonly string[];
  expected: readonly string[];
  kind: 'letter' | 'word';
  fixed: readonly FixedChip[] | undefined;
  tiles: boolean;
  eraseLabel: string | undefined;
  onAnswer: (chosen: number[]) => void;
}) {
  const [answer, setAnswer] = useState<ChipsAnswer>();
  return (
    <OrderedChips
      chips={chips}
      kind={kind}
      fixed={fixed}
      {...(tiles ? { layout: 'tiles' as const, slots: expected.length } : {})}
      eraseLabel={eraseLabel}
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
  tiles = false,
  eraseLabel,
  onAnswer = jest.fn(),
}: {
  chips?: readonly string[];
  expected?: readonly string[];
  kind?: 'letter' | 'word';
  fixed?: readonly FixedChip[];
  tiles?: boolean;
  eraseLabel?: string;
  onAnswer?: (chosen: number[]) => void;
} = {}) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <Round
        chips={chips}
        expected={expected}
        kind={kind}
        fixed={fixed}
        tiles={tiles}
        eraseLabel={eraseLabel}
        onAnswer={onAnswer}
      />
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

  describe('the erase key', () => {
    const ERASE = '← Erase a letter';

    it('takes back the last letter placed, then the one before', async () => {
      await renderChips({ eraseLabel: ERASE });
      await tap(1, 3, 2);

      await fireEvent.press(screen.getByRole('button', { name: ERASE }));
      expect(lineText()).toEqual(['o', 'b']);
      expect(screen.getByTestId('chips-2')).toBeEnabled();

      await fireEvent.press(screen.getByRole('button', { name: ERASE }));
      expect(lineText()).toEqual(['o']);
    });

    it('takes nothing back from an empty line or a given answer', async () => {
      const onAnswer = jest.fn();
      await renderChips({ eraseLabel: ERASE, onAnswer });
      expect(screen.getByRole('button', { name: ERASE })).toBeDisabled();

      await tap(1, 3, 2, 4, 0);

      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: ERASE })).toBeDisabled();
      expect(lineText()).toEqual(['o', 'b', 'r', 'o', 'k']);
    });

    it('shows no erase key with no label', async () => {
      await renderChips();
      await tap(1);

      expect(screen.queryByRole('button', { name: ERASE })).toBeNull();
    });
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

  it('moves no chip of a wrong answer', async () => {
    await renderChips();

    // o, r where b belongs, then the rest.
    await tap(1, 2, 3, 4, 0);
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(shiftOf(1)).toBe(0);
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

  it('moves no word of a wrong expression', async () => {
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

    expect(shiftOf(0)).toBe(0);
    expect([1, 2, 3].map(shiftOf)).toEqual([0, 0, 0]);
  });

  describe('the look of an answer', () => {
    const { accent, surfaceSunken, tile } = coreTokens.colors.light;
    const fillOf = (index: number) =>
      (
        getAnimatedStyle(screen.getByTestId(`chips-line-${String(index)}`)) as {
          backgroundColor?: unknown;
        }
      ).backgroundColor;
    /** A colour token as the line's fill shows it, in rgba. */
    const rgba = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
      return `rgba(${String(r)}, ${String(g)}, ${String(b)}, 1)`;
    };
    const slots = () =>
      screen.queryAllByTestId(/^chips-slot-\d+$/, { includeHiddenElements: true });

    it('shows a dashed place for each chip not yet in the line', async () => {
      await renderChips();
      expect(slots()).toHaveLength(5);

      await tap(1, 3);

      expect(slots()).toHaveLength(3);
      expect(screen.getByTestId('chips-line-0')).toHaveStyle({ backgroundColor: tile });
    });

    it('turns a right line red', async () => {
      await renderChips();

      await tap(1, 3, 2, 4, 0);
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect([0, 1, 2, 3, 4].map(fillOf)).toEqual(Array(5).fill(rgba(accent)));
    });

    it('sinks a wrong line', async () => {
      await renderChips();

      await tap(1, 2, 3, 4, 0);
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect([0, 1, 2, 3, 4].map(fillOf)).toEqual(Array(5).fill(rgba(surfaceSunken)));
    });

    it('turns a right line red with Reduce Motion as well', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await renderChips();

      await tap(1, 3, 2, 4, 0);
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(fillOf(0)).toBe(rgba(accent));
      expect(shiftOf(0)).toBe(0);
    });
  });

  describe('as letter tiles', () => {
    /** «obrok» shuffled with three decoys: 8 tiles. */
    const TILES = ['k', 'x', 'o', 'r', 'z', 'b', 'o', 'q'];

    it('stands the tiles, decoys among them, in rows of 4 under a slot for each letter', async () => {
      await renderChips({ chips: TILES, tiles: true });

      expect(screen.getAllByTestId(/^chips-row-\d+$/)).toHaveLength(2);
      for (const row of screen.getAllByTestId(/^chips-row-\d+$/)) {
        expect(within(row).getAllByRole('button')).toHaveLength(4);
      }
      expect(
        screen.getAllByTestId(/^chips-slot-\d+$/, { includeHiddenElements: true }),
      ).toHaveLength(WORD.length);
    });

    it('returns the letter of a filled slot tapped to its tile', async () => {
      await renderChips({ chips: TILES, tiles: true });

      await tap(2, 5);
      await fireEvent.press(screen.getByTestId('chips-line-0'));

      expect(lineText()).toEqual(['b']);
      expect(screen.getByTestId('chips-2')).toBeEnabled();
    });

    it('gives the answer once every slot is filled, decoys left over', async () => {
      const onAnswer = jest.fn();
      await renderChips({ chips: TILES, tiles: true, onAnswer });

      await tap(2, 5, 3, 6);
      expect(onAnswer).not.toHaveBeenCalled();
      await tap(0);

      expect(onAnswer).toHaveBeenCalledWith([2, 5, 3, 6, 0]);
      expect(lineText()).toEqual(['o', 'b', 'r', 'o', 'k']);
    });
  });
});
