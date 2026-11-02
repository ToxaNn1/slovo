import { Chip, EditionProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

function Tab({ disabled, onPress }: { disabled?: boolean; onPress?: () => void }) {
  const [on, setOn] = useState(false);
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <Chip
        testID="tab"
        label="Words"
        count={12}
        accessibilityLabel="Words, 12"
        accessibilityHint="The last one stays on"
        on={on}
        disabled={disabled ?? false}
        onPress={() => {
          setOn(!on);
          onPress?.();
        }}
      />
    </EditionProvider>
  );
}

function scale(): number {
  const style = getAnimatedStyle(screen.getByTestId('tab-face')) as {
    transform?: { scale?: number }[];
  };
  return style.transform?.find((step) => step.scale !== undefined)?.scale ?? 1;
}

async function pass(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('Chip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows its label and count, and turns on with a press', async () => {
    await render(<Tab />);
    expect(screen.getByText('Words')).toBeOnTheScreen();
    expect(screen.getByText('12')).toBeOnTheScreen();
    const chip = screen.getByRole('button', { name: 'Words, 12' });
    expect(chip).not.toBeSelected();

    await fireEvent.press(chip);

    expect(chip).toBeSelected();
  });

  it('shrinks while pressed and comes back when let go', async () => {
    await render(<Tab />);
    const chip = screen.getByRole('button', { name: 'Words, 12' });

    await fireEvent(chip, 'pressIn');
    await pass(200);
    expect(scale()).toBeCloseTo(0.95);

    await fireEvent(chip, 'pressOut');
    await pass(200);
    expect(scale()).toBeCloseTo(1);
  });

  it('stays still while pressed under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<Tab />);
    await pass(0);

    await fireEvent(screen.getByRole('button', { name: 'Words, 12' }), 'pressIn');
    await pass(200);

    expect(scale()).toBe(1);
  });

  it('takes no press while disabled and reads its hint', async () => {
    const onPress = jest.fn();
    await render(<Tab disabled onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Words, 12' });
    expect(chip).toBeDisabled();
    expect(chip).toHaveProp('accessibilityHint', 'The last one stays on');

    await fireEvent.press(chip);

    expect(onPress).not.toHaveBeenCalled();
  });
});
