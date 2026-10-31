import { EditionProvider, OnboardingWelcome } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  splash: { wordmark: 'SLOVO' },
  onboarding: {
    skip: 'Skip',
    step: 'STEP {step} OF {total}',
    stepLabel: 'Step {step} of {total}',
    welcome: { start: 'Start', title: 'Rare words', subtitle: 'One a day' },
  },
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderWelcome() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
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
});
