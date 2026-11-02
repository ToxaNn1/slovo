import { EditionProvider, Switch } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

/** The knob's travel from off to on: the track's 54 less the knob's 26 and its two 3 insets. */
const TRAVEL = 22;

function Toggle({ initial, disabled }: { initial: boolean; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <Switch
        testID="sounds"
        accessibilityLabel="Sounds"
        value={value}
        onValueChange={setValue}
        disabled={disabled}
      />
    </EditionProvider>
  );
}

function knob(): { opacity: number; shift: number } {
  const style = getAnimatedStyle(screen.getByTestId('sounds-knob')) as {
    opacity?: number;
    transform?: { translateX?: number }[];
  };
  return {
    opacity: style.opacity ?? 1,
    shift: style.transform?.find((step) => step.translateX !== undefined)?.translateX ?? 0,
  };
}

async function pass(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('Switch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reads as a switch with its label and state, and turns on with a press', async () => {
    await render(<Toggle initial={false} />);
    const toggle = screen.getByRole('switch', { name: 'Sounds' });
    expect(toggle).not.toBeChecked();

    await fireEvent.press(toggle);

    expect(toggle).toBeChecked();
  });

  it('slides its knob over, past its place and back', async () => {
    await render(<Toggle initial={false} />);
    expect(knob().shift).toBe(0);

    await fireEvent.press(screen.getByRole('switch'));
    await pass(120);
    const overshoot = knob().shift;
    await pass(400);

    expect(overshoot).toBeGreaterThan(TRAVEL);
    expect(knob().shift).toBeCloseTo(TRAVEL);
  });

  it('turns off back to the start', async () => {
    await render(<Toggle initial />);
    expect(knob().shift).toBeCloseTo(TRAVEL);

    await fireEvent.press(screen.getByRole('switch'));
    await pass(400);

    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(knob().shift).toBeCloseTo(0);
  });

  it('does not slide under Reduce Motion: the knob fades in at its new place', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<Toggle initial={false} />);
    await pass(0);

    await fireEvent.press(screen.getByRole('switch'));
    await pass(16);
    const start = knob();
    await pass(400);

    expect(start.shift).toBe(TRAVEL);
    expect(start.opacity).toBeLessThan(1);
    expect(knob()).toEqual({ shift: TRAVEL, opacity: 1 });
  });

  it('takes no press while disabled', async () => {
    await render(<Toggle initial disabled />);
    const toggle = screen.getByRole('switch');

    await fireEvent.press(toggle);

    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
  });
});
