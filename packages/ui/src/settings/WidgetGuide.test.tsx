import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, WidgetGuide } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

const strings = {} as unknown as EditionStrings;

const STEPS = [
  { title: 'Hold an empty spot', hint: 'The icons start to jiggle.' },
  { title: 'Tap Edit, then Add Widget', hint: 'Find SLOVO and pick a size.' },
  { title: 'Tap the widget', hint: 'Pick its mode.' },
];

async function renderGuide() {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <WidgetGuide
        testID="guide"
        steps={STEPS}
        caption="Small · Medium"
        mode="ALL WORDS"
        lemma="word"
        definition="a short line"
      />
    </EditionProvider>,
  );
}

/** How far a step is in, from 0 (not yet) to 1 (in place). */
function shownOf(step: number): number {
  const style = getAnimatedStyle(screen.getByTestId(`guide-step-${String(step)}`)) as {
    opacity?: number;
  };
  return style.opacity ?? 1;
}

/** Lets the given milliseconds pass on the faked timers. */
async function pass(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('WidgetGuide', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('numbers the steps, which VoiceOver reads with their hints', async () => {
    await renderGuide();

    expect(screen.getByLabelText('1. Hold an empty spot. The icons start to jiggle.')).toBeTruthy();
    expect(screen.getByLabelText('3. Tap the widget. Pick its mode.')).toBeTruthy();
  });

  it('brings the steps in one after another', async () => {
    await renderGuide();
    await pass(500);

    expect([1, 2, 3].map(shownOf)).toEqual([1, 0, 0]);

    await pass(1700);

    expect([1, 2, 3].map(shownOf)).toEqual([1, 1, 1]);
  });

  it('brings each step in within 300 ms', async () => {
    await renderGuide();
    await pass(150);

    expect(shownOf(1)).toBeGreaterThan(0);
    expect(shownOf(1)).toBeLessThan(1);

    await pass(150);

    expect(shownOf(1)).toBe(1);
  });

  it('shows every step still, at once, with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderGuide();
    await pass(0);

    expect([1, 2, 3].map(shownOf)).toEqual([1, 1, 1]);
  });
});
