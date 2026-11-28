import {
  coreTokens,
  EditionProvider,
  OnboardingStep,
  OnboardingWelcome,
  TokensProvider,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
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

async function renderWelcome(on: Metrics = metrics, step = 1) {
  await render(
    <SafeAreaProvider initialMetrics={on}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingWelcome
          step={step}
          total={4}
          hero={undefined}
          statisticsLine={false}
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

// The animation audit (O5): an onboarding step comes in within 300 ms.
describe('An onboarding step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('moves VoiceOver to a later step once it has slid in, not while it is still clear', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    focus.mockClear();
    await renderWelcome(metrics, 2);
    await pass(150);

    expect(focus).not.toHaveBeenCalled();

    await pass(150);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]?.[1]).toBe('focus');
  });

  it('names its «Skip» to VoiceOver in the Edition’s words', async () => {
    await renderWelcome();

    expect(screen.getByTestId('onboarding-skip')).toHaveProp('accessibilityLabel', 'Skip');
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

  it("draws its shout word in the board's ink on the red in the dark Theme too", async () => {
    await render(
      <TokensProvider tokens={coreTokens} colorScheme="dark">
        <SafeAreaProvider initialMetrics={metrics}>
          <EditionProvider edition={{ locale: 'en' }} strings={strings}>
            <OnboardingWelcome
              step={1}
              total={4}
              hero={undefined}
              statisticsLine={false}
              onStart={jest.fn()}
              onSkip={jest.fn()}
            />
          </EditionProvider>
        </SafeAreaProvider>
      </TokensProvider>,
    );

    expect(screen.getByText('WORD')).toHaveStyle({ color: coreTokens.colors.light.ink });
  });

  it('keeps its shout word in place, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderWelcome();
    await pass(150);

    expect(shoutAside()).toBeCloseTo(0);
  });

  it('starts no fly-in before the system says whether Reduce Motion is on', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(new Promise<boolean>(() => undefined));
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

  // Owner test pass B-002: the main button sat the home indicator's height above the board's place.
  it("puts its buttons as far from the screen's bottom edge as the board", async () => {
    await renderWelcome(notched);
    expect(styleOf('onboarding')['paddingBottom'] ?? 0).toBe(0);
    expect(styleOf('onboarding-footer')['paddingBottom']).toBe(40);
  });

  it('keeps its buttons above the home indicator when it is taller than the board leaves', async () => {
    await renderWelcome({ ...notched, insets: { ...notched.insets, bottom: 48 } });
    expect(styleOf('onboarding-footer')['paddingBottom']).toBe(48);
  });

  // Owner test pass B-001: the shout word ran into the screen's left edge and was cut.
  it("insets its shout word from the screen's left edge", async () => {
    await renderWelcome(notched);
    expect(Number(styleOf('onboarding-shout')['left'])).toBeGreaterThan(0);
  });

  // Shot pass on #1512: on iPhone SE the full red top left room for the title alone.
  it("leaves the content the board's room on the smallest phone, its red top drawn smaller", async () => {
    await renderWelcome(small);
    const hero = Number(styleOf('onboarding-hero')['height']);
    // The board leaves 844 − 34 − 440 points under its red top for the content and buttons.
    expect(small.frame.height - small.insets.bottom - hero).toBeGreaterThanOrEqual(370);
    expect(shoutOnScreen().scale).toBeCloseTo(hero / 440);
  });

  // Visual audit t8 (#1532): the first Word's card ran under «Далі», its quote out of sight.
  describe('with content taller than the room under its red top', () => {
    /** Lays out the step's buttons and content at the given heights. */
    async function layOut({ footer, content }: { footer: number; content: number }) {
      await fireEvent(screen.getByTestId('onboarding-footer'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: footer } },
      });
      await fireEvent(screen.getByTestId('onboarding-content'), 'contentSizeChange', 390, content);
    }
    const room = notched.frame.height - notched.insets.bottom;

    it('draws its red top shorter, so the whole content shows above the buttons', async () => {
      await renderWelcome(notched);
      await layOut({ footer: 108, content: 400 });
      const hero = Number(styleOf('onboarding-hero')['height']);
      expect(hero + 400 + 108).toBe(room);
      expect(shoutOnScreen().scale).toBeCloseTo(hero / 440);
    });

    it('keeps a red top that holds its art, and lets the rest of the content scroll', async () => {
      await renderWelcome(notched);
      await layOut({ footer: 108, content: 1000 });
      expect(styleOf('onboarding-hero')['height']).toBe(260);
    });

    it("keeps the board's red top when the content fits under it", async () => {
      await renderWelcome(notched);
      await layOut({ footer: 108, content: 200 });
      expect(styleOf('onboarding-hero')['height']).toBe(440);
    });
  });
});

describe('The first Word’s step, which opens on its red top over the whole screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderIntro(on: Metrics = small) {
    await render(
      <SafeAreaProvider initialMetrics={on}>
        <EditionProvider edition={{ locale: 'en' }} strings={strings}>
          <OnboardingStep
            step={2}
            total={4}
            shout="HOLD!"
            onSkip={jest.fn()}
            footer={<Text>Take</Text>}
            intro
            testID="onboarding"
          >
            <Text>Card</Text>
          </OnboardingStep>
        </EditionProvider>
      </SafeAreaProvider>,
    );
  }

  /** How far a view is moved up or down from its place. */
  function shift(testID: string): number {
    // Where it sits, whether or not VoiceOver reaches it yet.
    const view = screen.getByTestId(testID, { includeHiddenElements: true });
    const style = getAnimatedStyle(view) as {
      transform?: { translateY?: number }[];
    };
    return style.transform?.[0]?.translateY ?? 0;
  }

  // On iPhone SE: the dots' room is 6 + 8 + 40 points, the band «Пропустити»'s row and the cut.
  const cover = small.frame.height - (6 + 8 + 40);
  const band = small.insets.top + 44 + 24;

  it('covers the screen down to its dots, the content waiting under the red', async () => {
    await renderIntro();
    await pass(50);

    expect(styleOf('onboarding-hero')['height']).toBe(cover);
    expect(shift('onboarding-hero')).toBeCloseTo(0);
    expect(shift('onboarding-content')).toBeCloseTo(cover - band);
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();
  });

  it('hides the content and the buttons from VoiceOver while the red covers the screen', async () => {
    await renderIntro();
    await pass(100);

    expect(screen.queryByText('Card', { includeHiddenElements: false })).toBeNull();
    expect(screen.queryByText('Take', { includeHiddenElements: false })).toBeNull();
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('onboarding-intro'));
    await pass(500 + 50);

    expect(screen.getByText('Card', { includeHiddenElements: false })).toBeTruthy();
    expect(screen.getByText('Take', { includeHiddenElements: false })).toBeTruthy();
  });

  it('gives way to its band once the shout word has flown in and held, the content risen to its place', async () => {
    await renderIntro();
    await pass(600 + 400 + 500 + 50);

    expect(shift('onboarding-hero')).toBeCloseTo(band - cover);
    expect(shift('onboarding-content')).toBeCloseTo(0);
    expect(screen.queryByTestId('onboarding-intro')).toBeNull();
  });

  it('gives way at once at a tap while the red covers the screen', async () => {
    await renderIntro();
    await pass(100);
    await fireEvent.press(screen.getByTestId('onboarding-intro'));
    await pass(500 + 50);

    expect(shift('onboarding-hero')).toBeCloseTo(band - cover);
    expect(shift('onboarding-content')).toBeCloseTo(0);
  });

  it('opens at once, nothing moving, with Reduce Motion', async () => {
    reduceMotion(true);
    await renderIntro();
    await pass(0);

    expect(shift('onboarding-hero')).toBeCloseTo(band - cover);
    expect(shift('onboarding-content')).toBeCloseTo(0);
    expect(screen.queryByTestId('onboarding-intro')).toBeNull();
  });
});
