import { BottomSheet, EditionProvider, RouteProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function sheet(visible: boolean, onClose: () => void, onDismissed: () => void) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} testID="sheet">
          <Text>Content</Text>
        </BottomSheet>
      </EditionProvider>
    </SafeAreaProvider>
  );
}

/**
 * The sheet's owner: `visible` from the test, and, when it `closesOnAsk`, closed
 * at once by its own `onClose`, as an owner that agrees to close.
 */
function Owner({
  visible,
  closesOnAsk,
  onClose,
  onDismissed,
}: {
  visible: boolean;
  closesOnAsk: boolean;
  onClose: () => void;
  onDismissed: () => void;
}) {
  const [closed, setClosed] = useState(false);
  return sheet(
    visible && !closed,
    () => {
      onClose();
      if (closesOnAsk) setClosed(true);
    },
    onDismissed,
  );
}

async function renderSheet({ closesOnAsk = false }: { closesOnAsk?: boolean } = {}) {
  const onClose = jest.fn();
  const onDismissed = jest.fn();
  const owner = (visible: boolean) => (
    <Owner
      visible={visible}
      closesOnAsk={closesOnAsk}
      onClose={onClose}
      onDismissed={onDismissed}
    />
  );
  await render(owner(true));
  const close = async () => {
    await screen.rerender(owner(false));
  };
  const open = async () => {
    await screen.rerender(owner(true));
  };
  return { onClose, onDismissed, close, open };
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

/** A drag on its top by `distance` points down, let go at `velocity` points per second. */
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

  it('slides up in 450 ms, a little past its place first', async () => {
    await renderSheet();
    await pass(150);

    expect(sheetNow().down).toBeGreaterThan(0);
    expect(sheetNow().opacity).toBe(1);

    await pass(180);

    expect(sheetNow().down).toBeLessThan(0);

    await pass(120);

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
    const { onClose, onDismissed } = await renderSheet({ closesOnAsk: true });
    await pass(300);
    await drag(40, 1500);

    expect(onClose).toHaveBeenCalledTimes(1);

    await pass(50);

    expect(sheetNow().down).toBeGreaterThan(40);
    expect(sheetNow().opacity).toBe(1);

    await pass(400);

    expect(screen.queryByText('Content')).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('springs back in place when its owner keeps it open after a flick', async () => {
    const { onClose } = await renderSheet();
    await pass(300);
    await drag(40, 1500);

    expect(onClose).toHaveBeenCalledTimes(1);

    await pass(400);

    expect(sheetNow().down).toBeCloseTo(0, 0);
    expect(screen.getByText('Content')).toBeOnTheScreen();
  });

  it('is back in place at once when its owner keeps it open after a flick, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderSheet();
    await pass(300);
    await drag(40, 1500);

    expect(sheetNow()).toEqual({ down: 0, opacity: 1 });
  });

  it('slides up again in 450 ms when opened after a flick closed it', async () => {
    const { close, open } = await renderSheet();
    await pass(300);
    await drag(40, 1500);
    await close();
    await pass(500);

    await open();
    await pass(150);

    expect(sheetNow().down).toBeGreaterThan(0);

    await pass(300);

    expect(sheetNow()).toEqual({ down: 0, opacity: 1 });
  });

  it('fades out where a flick leaves it, with Reduce Motion', async () => {
    reduceMotion(true);
    const { onDismissed } = await renderSheet({ closesOnAsk: true });
    await pass(300);
    await drag(40, 1500);
    await pass(110);

    expect(sheetNow().down).toBe(40);
    expect(sheetNow().opacity).toBeLessThan(1);

    await pass(200);

    expect(screen.queryByText('Content')).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it('asks to close at a tap on the scrim', async () => {
    const { onClose } = await renderSheet();
    await pass(450);

    await fireEvent.press(screen.getByTestId('sheet-scrim'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks to close at a tap on its slanted top, where a tall sheet leaves the scrim', async () => {
    const { onClose } = await renderSheet();
    await pass(450);

    await act(() => {
      fireGestureHandler(getByGestureTestId('sheet-tap'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
    });
    await pass(0);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet on a route', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function onRoute(route: string, onClose?: () => void) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <RouteProvider route={route}>
            {/* Without `onClose`, as the Game's answer sheet, which only «Далі» closes. */}
            {onClose === undefined ? (
              <BottomSheet visible testID="sheet">
                <Text>Content</Text>
              </BottomSheet>
            ) : (
              <BottomSheet visible onClose={onClose} testID="sheet">
                <Text>Content</Text>
              </BottomSheet>
            )}
          </RouteProvider>
        </EditionProvider>
      </SafeAreaProvider>
    );
  }

  it('asks to close when another route comes on screen', async () => {
    const onClose = jest.fn();
    await render(onRoute('/settings/notifications', onClose));
    await pass(450);
    expect(onClose).not.toHaveBeenCalled();

    await screen.rerender(onRoute('/settings/about', onClose));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves while another route is on screen when only its content closes it, and is back with its route', async () => {
    await render(onRoute('/game/w_1'));
    await pass(450);
    expect(screen.getByText('Content')).toBeOnTheScreen();

    await screen.rerender(onRoute('/settings/about'));
    await pass(300);
    expect(screen.queryByText('Content')).not.toBeOnTheScreen();

    await screen.rerender(onRoute('/game/w_1'));
    await pass(450);
    expect(screen.getByText('Content')).toBeOnTheScreen();
  });
});
