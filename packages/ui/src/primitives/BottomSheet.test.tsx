import type { EditionStrings } from '@slovo/contracts';
import { BottomSheet, EditionProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function sheet(visible: boolean, onClose: () => void, onDismissed: () => void) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
        <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} testID="sheet">
          <Text>Content</Text>
        </BottomSheet>
      </EditionProvider>
    </SafeAreaProvider>
  );
}

async function renderSheet() {
  const onClose = jest.fn();
  const onDismissed = jest.fn();
  await render(sheet(true, onClose, onDismissed));
  const close = async () => {
    await screen.rerender(sheet(false, onClose, onDismissed));
  };
  return { onClose, onDismissed, close };
}

/** Where the sheet is: how far down from its place, and how opaque. */
function sheetNow(): { down: number; opacity: number } {
  const style = getAnimatedStyle(screen.getByTestId('sheet-panel')) as {
    transform?: { translateY: number }[];
    opacity?: number;
  };
  return { down: style.transform?.[0]?.translateY ?? 0, opacity: style.opacity ?? 1 };
}

/** Lets the given milliseconds pass on the faked timers. */
async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** A drag on the grabber by `distance` points down, let go at `velocity` points per second. */
async function drag(distance: number, velocity: number) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('sheet-drag'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: 0, velocityY: velocity },
      { state: State.ACTIVE, translationY: distance, velocityY: velocity },
      { state: State.END, translationY: distance, velocityY: velocity },
    ]);
  });
  // What the gesture hands to the JavaScript thread arrives on the next tick.
  await pass(0);
}

function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
}

describe('BottomSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('slides up in 300 ms', async () => {
    await renderSheet();
    await pass(150);

    expect(sheetNow().down).toBeGreaterThan(0);
    expect(sheetNow().opacity).toBe(1);

    await pass(150);

    expect(sheetNow()).toEqual({ down: 0, opacity: 1 });
  });

  it('fades in place, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderSheet();
    await pass(150);

    expect(sheetNow().down).toBe(0);
    expect(sheetNow().opacity).toBeGreaterThan(0);
    expect(sheetNow().opacity).toBeLessThan(1);

    await pass(150);

    expect(sheetNow()).toEqual({ down: 0, opacity: 1 });
  });

  it('fades out in place when closed, with Reduce Motion', async () => {
    reduceMotion(true);
    const { onDismissed, close } = await renderSheet();
    await pass(300);
    await close();
    await pass(110);

    expect(sheetNow().down).toBe(0);
    expect(sheetNow().opacity).toBeGreaterThan(0);
    expect(sheetNow().opacity).toBeLessThan(1);

    await pass(200);

    expect(screen.queryByText('Content')).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('springs back within 300 ms after a short drag', async () => {
    const { onClose } = await renderSheet();
    await pass(300);
    await drag(60, 0);
    await pass(50);

    expect(sheetNow().down).toBeGreaterThan(0);

    await pass(300);

    expect(sheetNow().down).toBeCloseTo(0, 0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is back in place at once after a short drag, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderSheet();
    await pass(300);
    await drag(60, 0);

    expect(sheetNow()).toEqual({ down: 0, opacity: 1 });
  });

  it('carries on down from where a flick leaves it, then is gone', async () => {
    const { onClose, onDismissed, close } = await renderSheet();
    await pass(300);
    await drag(40, 1500);

    expect(onClose).toHaveBeenCalledTimes(1);

    await close();
    await pass(50);

    expect(sheetNow().down).toBeGreaterThan(40);
    expect(sheetNow().opacity).toBe(1);

    await pass(400);

    expect(screen.queryByText('Content')).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('fades out where a flick leaves it, with Reduce Motion', async () => {
    reduceMotion(true);
    const { onDismissed, close } = await renderSheet();
    await pass(300);
    await drag(40, 1500);
    await close();
    await pass(110);

    expect(sheetNow().down).toBe(40);
    expect(sheetNow().opacity).toBeLessThan(1);

    await pass(200);

    expect(screen.queryByText('Content')).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });
});
