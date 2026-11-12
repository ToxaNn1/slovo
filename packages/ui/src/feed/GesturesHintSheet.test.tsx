import { EditionProvider, GesturesHintSheet, useGesturesDemo } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const texts = {
  title: 'SWIPE',
  rows: {
    known: { title: 'Right', body: 'I know it' },
    unknown: { title: 'Left', body: 'I do not know it' },
    next: { title: 'Up', body: 'Next card' },
  },
  dismiss: 'GOT IT',
};

/** The sheet with the swipe hint's demo playing while `demo`, as the Feed draws it. */
function Hint({
  demo,
  onShown,
  onDismiss,
}: {
  demo: boolean;
  onShown: () => void;
  onDismiss: () => void;
}) {
  const playing = useGesturesDemo(demo);
  return (
    <GesturesHintSheet
      visible
      texts={texts}
      demo={playing}
      onShown={onShown}
      onDismiss={onDismiss}
    />
  );
}

async function draw({
  reduceMotion = false,
  demo = true,
  onShown = () => undefined,
  onDismiss = () => undefined,
}: {
  reduceMotion?: boolean;
  demo?: boolean;
  onShown?: () => void;
  onDismiss?: () => void;
}) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <Hint demo={demo} onShown={onShown} onDismiss={onDismiss} />
    </EditionProvider>,
  );
}

async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** How lit a row is, 0 to 1. */
function light(gesture: string): number {
  const style = getAnimatedStyle(screen.getByTestId(`gestures-hint-${gesture}-light`)) as {
    opacity?: number;
  };
  return style.opacity ?? 1;
}

/** Where the finger is, off its rest over the card. */
function finger(): { x: number; y: number } {
  const { transform = [] } = getAnimatedStyle(screen.getByTestId('gestures-hint-finger-tip')) as {
    transform?: readonly Partial<Record<'translateX' | 'translateY', number>>[];
  };
  return {
    x: transform.find((step) => step.translateX !== undefined)?.translateX ?? 0,
    y: transform.find((step) => step.translateY !== undefined)?.translateY ?? 0,
  };
}

describe('GesturesHintSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows its title and a row per gesture: right, left, up', async () => {
    await draw({});
    expect(screen.getByText('SWIPE')).toBeOnTheScreen();
    expect(screen.getByTestId('gestures-hint-known')).toHaveTextContent(/Right.*I know it/);
    expect(screen.getByTestId('gestures-hint-unknown')).toHaveTextContent(/Left.*I do not know it/);
    expect(screen.getByTestId('gestures-hint-next')).toHaveTextContent(/Up.*Next card/);
  });

  it('asks onDismiss on its dismiss button', async () => {
    const onDismiss = jest.fn();
    await draw({ onDismiss });
    expect(onDismiss).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('gestures-hint-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onShown once it is drawn', async () => {
    const onShown = jest.fn();
    await draw({ onShown });
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  // Board XSwipeV: the finger drags right, left and up in 8.4 s, and each row lights with its gesture.
  it('moves the finger with the demo and lights each row with its gesture', async () => {
    await draw({});
    expect(screen.getByTestId('gestures-hint-finger')).toBeOnTheScreen();

    await pass(1760);
    expect(finger().x).toBeCloseTo(118);
    expect([light('known'), light('unknown'), light('next')]).toEqual([1, 0, 0]);

    await pass(2690);
    expect(finger().x).toBeCloseTo(-118);
    expect([light('known'), light('unknown'), light('next')]).toEqual([0, 1, 0]);

    await pass(2780);
    expect(finger()).toEqual({ x: 0, y: -110 });
    expect([light('known'), light('unknown'), light('next')]).toEqual([0, 0, 1]);
  });

  it('draws no finger and lights no row without the demo', async () => {
    await draw({ demo: false });
    await pass(1760);
    expect(screen.queryByTestId('gestures-hint-finger')).toBeNull();
    expect(light('known')).toBe(0);
  });

  it('draws no finger with Reduce Motion', async () => {
    await draw({ reduceMotion: true });
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint-finger')).toBeNull();
  });
});
