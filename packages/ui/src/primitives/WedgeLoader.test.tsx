import { EditionProvider, WedgeLoader } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

async function renderLoader(reduceMotion: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <WedgeLoader testID="loader" />
    </EditionProvider>,
  );
  await pass(0);
}

/** How tall each of the three wedges is drawn, as a share of its full height. */
function heights(): number[] {
  return [0, 1, 2].map((index) => {
    const style = getAnimatedStyle(screen.getByTestId(`loader-${String(index)}`)) as {
      transform?: { scaleY: number }[];
    };
    return Math.round((style.transform?.[0]?.scaleY ?? 1) * 100) / 100;
  });
}

async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('WedgeLoader', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('grows its wedges to full height one after another, then shrinks them, over and over', async () => {
    await renderLoader(false);

    await pass(400);
    expect(heights()).toEqual([1, expect.any(Number), expect.any(Number)]);
    expect(heights()[2]).toBeLessThan(1);

    await pass(300);
    expect(heights()[2]).toBe(1);
    expect(heights()[0]).toBeLessThan(1);

    // One beat later the first wedge is at full height again.
    await pass(500);
    expect(heights()[0]).toBe(1);
  });

  it('stands still at full height under Reduce Motion', async () => {
    await renderLoader(true);

    expect(heights()).toEqual([1, 1, 1]);
    await pass(500);
    expect(heights()).toEqual([1, 1, 1]);
  });
});
