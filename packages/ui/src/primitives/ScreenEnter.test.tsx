import { ReduceMotionProvider, ScreenEnter } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

async function renderScreen({
  focused,
  reduceMotion = false,
}: {
  focused: boolean;
  reduceMotion?: boolean;
}) {
  const shown = (isFocused: boolean) => (
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <ScreenEnter focused={isFocused} testID="feed">
        <Text>Feed</Text>
      </ScreenEnter>
    </ReduceMotionProvider>
  );
  const view = await render(shown(focused));
  await act(async () => {
    await Promise.resolve();
  });
  return { focus: (isFocused: boolean) => view.rerender(shown(isFocused)) };
}

interface Style {
  opacity?: number;
  transform?: { translateX?: number }[];
}

function styleOf(testID: string) {
  const style = getAnimatedStyle(screen.getByTestId(testID)) as Style;
  return {
    shift: style.transform?.find((step) => step.translateX !== undefined)?.translateX ?? 0,
    opacity: style.opacity ?? 1,
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('ScreenEnter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('slides the screen in under the wedge wipe when it gains focus', async () => {
    const { focus } = await renderScreen({ focused: false });
    expect(styleOf('feed-content').shift).toBe(30);
    expect(styleOf('feed-wipe').shift).toBeCloseTo(0);

    await focus(true);
    await wait(500);

    expect(screen.getByText('Feed')).toBeTruthy();
    expect(styleOf('feed-content').shift).toBeCloseTo(0);
    // The wipe has left the screen to the left.
    expect(styleOf('feed-wipe').shift).toBeLessThan(0);
  });

  it('enters again each time it gains focus', async () => {
    const { focus } = await renderScreen({ focused: true });
    await wait(500);
    await focus(false);
    await wait(0);

    expect(styleOf('feed-content').shift).toBe(30);
  });

  it('fades the screen in once, with no wipe or sweep, under Reduce Motion', async () => {
    const { focus } = await renderScreen({ focused: false, reduceMotion: true });
    expect(screen.queryByTestId('feed-wipe')).toBeNull();
    expect(screen.queryByTestId('feed-sweep')).toBeNull();
    expect(styleOf('feed-content')).toEqual({ shift: 0, opacity: 0 });

    await focus(true);
    await wait(300);

    expect(styleOf('feed-content')).toEqual({ shift: 0, opacity: 1 });
  });
});
