import type { Correction } from '@slovo/contracts';
import { CorrectionTypeRow, EditionProvider, ReduceMotionProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, type ViewStyle } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const strings = testStrings({
  correctionCard: {
    correctionTypes: { surzhyk: 'Surzhyk' },
    nonStandard: 'Often said',
    standard: 'Better said',
    otherEquivalents: 'also: {equivalents}',
  },
  dashboard: { correctionTypes: { reveal: 'How to say it?' } },
});

const correction: Correction = {
  kind: 'correction',
  id: 'c_shoby',
  nonStandardForm: 'shóby',
  correctionType: 'surzhyk',
  standardEquivalents: ['shchob', 'aby'],
  explanation: 'A calque of another language.',
  examplePair: { nonStandard: 'Said so.', standard: 'Better so.' },
  categoryId: 'everyday',
  sources: [{ title: 'Dictionary' }],
  literaryUses: [],
  retired: false,
};

async function renderRow(
  workedThrough: boolean,
  { index = 0, reduceMotion = false }: { index?: number; reduceMotion?: boolean } = {},
) {
  const onReveal = jest.fn();
  await render(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
        <CorrectionTypeRow
          correction={correction}
          workedThrough={workedThrough}
          index={index}
          onReveal={onReveal}
        />
      </EditionProvider>
    </ReduceMotionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return onReveal;
}

function cascade() {
  const style = getAnimatedStyle(screen.getByTestId('correction-type-row-c_shoby-cascade')) as {
    opacity?: number;
    transform?: { translateY?: number }[];
  };
  return {
    opacity: style.opacity ?? 1,
    rise: style.transform?.find((step) => step.translateY !== undefined)?.translateY ?? 0,
  };
}

function pop() {
  const style = getAnimatedStyle(screen.getByTestId('correction-type-revealed-c_shoby')) as {
    opacity?: number;
    transform?: { scale?: number }[];
  };
  return {
    opacity: style.opacity ?? 1,
    scale: style.transform?.find((step) => step.scale !== undefined)?.scale ?? 1,
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('CorrectionTypeRow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('not worked through, shows the type and the form struck through, with «How to say it?» that reveals', async () => {
    const onReveal = await renderRow(false);

    expect(screen.getByText('Surzhyk')).toBeTruthy();
    expect(screen.getByText('Often said')).toBeTruthy();
    expect(screen.getByLabelText('shoby')).toBeTruthy();
    expect(screen.queryByText('Better said')).toBeNull();
    expect(screen.queryByText('shchob')).toBeNull();
    expect(screen.queryByText('A calque of another language.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'How to say it?' }));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('strikes each line of the form where the board does, two thirds of the way down the letters', async () => {
    await renderRow(false);

    await fireEvent(screen.getByLabelText('shoby'), 'textLayout', {
      nativeEvent: { lines: [{ x: 0, y: 0, width: 120, height: 23.4, text: 'shóby' }] },
    });

    // The board's line-through on Onest 600 18/23.4, measured in Chrome:
    // 3 points thick, its middle 11.9 points below the line's top.
    const strike = screen.getByTestId('correction-type-strike');
    expect(strike).toHaveStyle({ left: 0, width: 120, height: 3 });
    const { top } = StyleSheet.flatten(strike.props['style']) as ViewStyle;
    expect(Number(top) + 1.5).toBeCloseTo(11.9, 1);
  });

  it('worked through, shows the main standard form, the others and the explanation, and no button', async () => {
    await renderRow(true);

    expect(screen.getByTestId('correction-type-revealed-c_shoby')).toBeTruthy();
    expect(screen.getByText('Better said')).toBeTruthy();
    expect(screen.getByText('shchob')).toBeTruthy();
    expect(screen.getByText('also: aby')).toBeTruthy();
    expect(screen.getByText('A calque of another language.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'How to say it?' })).toBeNull();
  });

  it('rises in 200 ms after the screen opens, 70 ms after the card before it', async () => {
    await renderRow(false, { index: 2 });

    expect(cascade()).toEqual({ opacity: 0, rise: 16 });

    await wait(340);
    expect(cascade()).toEqual({ opacity: 0, rise: 16 });

    await wait(450);
    expect(cascade()).toEqual({ opacity: 1, rise: 0 });
  });

  it('pops the revealed block in from 0.6 of its size, past it, and settles', async () => {
    await renderRow(true);

    expect(pop()).toEqual({ opacity: 1, scale: 0.6 });

    await wait(210);
    expect(pop().scale).toBeCloseTo(1.12);

    await wait(140);
    expect(pop()).toEqual({ opacity: 1, scale: 1 });
  });

  it('under Reduce Motion only fades the card and the revealed block in, without rising or popping', async () => {
    await renderRow(true, { index: 2, reduceMotion: true });

    expect(cascade()).toEqual({ opacity: 0, rise: 0 });
    expect(pop()).toEqual({ opacity: 0, scale: 1 });

    await wait(300);
    expect(cascade()).toEqual({ opacity: 1, rise: 0 });
    expect(pop()).toEqual({ opacity: 1, scale: 1 });
  });
});
