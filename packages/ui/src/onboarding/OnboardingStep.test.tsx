import { EditionProvider, OnboardingWelcome } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  splash: { wordmark: 'SLOVO' },
  onboarding: {
    skip: 'Skip',
    stepLabel: 'Step {step} of {total}',
    welcome: { shout: 'WORD', start: 'Start', title: 'Rare words', subtitle: 'One a day' },
  },
});

interface Metrics {
  frame: { x: number; y: number; width: number; height: number };
  insets: { top: number; left: number; right: number; bottom: number };
}

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
/** The phone the board is drawn on, with its notch and home indicator. */
const notched: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
/** The smallest phone: iPhone SE. */
const small: Metrics = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

async function renderWelcome(on: Metrics = metrics) {
  await render(
    <SafeAreaProvider initialMetrics={on}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingWelcome
          step={1}
          total={4}
          hero={undefined}
          onStart={jest.fn()}
          onSkip={jest.fn()}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

/** How far the step is from its place, sideways, and how opaque. */
function stepNow(): { aside: number; opacity: number } {
  const style = getAnimatedStyle(screen.getByTestId('onboarding')) as {
    transform?: { translateX: number }[];
    opacity?: number;
  };
  return { aside: style.transform?.[0]?.translateX ?? 0, opacity: style.opacity ?? 1 };
}

/** How far the shout word is from its place, sideways. */
function shoutAside(): number {
  const style = getAnimatedStyle(screen.getByTestId('onboarding-shout')) as {
    transform?: { translateX?: number }[];
  };
  return style.transform?.[0]?.translateX ?? 0;
}

/** A view's own numeric style, flattened. */
function styleOf(testID: string): Record<string, unknown> {
  return StyleSheet.flatten(screen.getByTestId(testID).props['style']) as Record<string, unknown>;
}

/** On the screen: how much the red top's art is scaled, and the highest point of the turned shout word. */
function shoutOnScreen(): { scale: number; highest: number } {
  const art = styleOf('onboarding-art');
  const transform = art['transform'] as { scale: number }[];
  const scale = transform[0]?.scale ?? 1;
  const shout = styleOf('onboarding-shout');
  const width = Number(art['width']) - Number(shout['left']) - Number(shout['right']);
  // Turned 8° about its middle, the word's right end rises by half its width times sin 8°.
  const rise = (width / 2) * Math.sin((8 * Math.PI) / 180);
  return { scale, highest: scale * (Number(shout['top']) - rise) };
}

/** Lets the given milliseconds pass on the faked timers. */
async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
}

// ADR 0055 and the animation audit (O5): an onboarding step comes in within 300 ms.
describe('An onboarding step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('slides in from the side in 300 ms', async () => {
    await renderWelcome();
    await pass(150);

    expect(stepNow().aside).toBeGreaterThan(0);

    await pass(150);

    expect(stepNow()).toEqual({ aside: 0, opacity: 1 });
  });

  it('fades in where it is, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderWelcome();
    await pass(150);

    expect(stepNow().aside).toBe(0);
    expect(stepNow().opacity).toBeGreaterThan(0);
    expect(stepNow().opacity).toBeLessThan(1);

    await pass(150);

    expect(stepNow()).toEqual({ aside: 0, opacity: 1 });
  });

  it('flies its shout word in from the left in 600 ms', async () => {
    await renderWelcome();
    await pass(50);

    expect(screen.getByText('WORD')).toBeTruthy();
    expect(shoutAside()).toBeLessThan(0);

    await pass(550);

    expect(shoutAside()).toBeCloseTo(0);
  });

  it('keeps its shout word in place, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderWelcome();
    await pass(150);

    expect(shoutAside()).toBeCloseTo(0);
  });

  // Audit C15: the shout word was cut to one letter and «…».
  it('draws its whole shout word, smaller when it is wider than the top, at any text size', async () => {
    await renderWelcome();
    const word = screen.getByTestId('onboarding-shout-word');
    const line = word.parent;
    if (line === null) throw new Error('The shout word has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 380 } } });
    // The word measured at full size: twice as wide as the top has room for, less a point.
    const measured = screen
      .getAllByText('WORD', { includeHiddenElements: true })
      .find((text) => text !== word);
    if (measured === undefined) throw new Error('The shout word is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 758 }] } });

    expect(word).toHaveTextContent('WORD');
    expect(word.props['numberOfLines']).toBeUndefined();
    expect(word.props['maxFontSizeMultiplier']).toBe(1);
    expect(word).toHaveStyle({ fontSize: 168 / 2 });
    expect(word).not.toHaveStyle({ opacity: 0 });
  });

  // Shot pass on #1512: under a notch the turned word rose into the skip button and covered it.
  it.each([
    ['under a notch', notched],
    ['on the smallest phone', small],
  ])('keeps its shout word under its skip button %s', async (_, on) => {
    await renderWelcome(on);
    const skipRowBottom = on.insets.top + 44;
    expect(shoutOnScreen().highest).toBeGreaterThanOrEqual(skipRowBottom);
  });

  it("draws its red top as the board on the board's phone", async () => {
    await renderWelcome(notched);
    expect(styleOf('onboarding-hero')['height']).toBe(440);
    expect(shoutOnScreen().scale).toBe(1);
  });

  // Shot pass on #1512: on iPhone SE the full red top left room for the title alone.
  it("leaves the content the board's room on the smallest phone, its red top drawn smaller", async () => {
    await renderWelcome(small);
    const hero = Number(styleOf('onboarding-hero')['height']);
    // The board leaves 844 − 34 − 440 points under its red top for the content and buttons.
    expect(small.frame.height - small.insets.bottom - hero).toBeGreaterThanOrEqual(370);
    expect(shoutOnScreen().scale).toBeCloseTo(hero / 440);
  });
});
