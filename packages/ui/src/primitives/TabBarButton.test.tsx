import { EditionProvider, ReduceMotionProvider, TabBarButton } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const strings = testStrings({});

async function renderTab({
  selected,
  reduceMotion = false,
  onPress = jest.fn(),
}: {
  selected: boolean;
  reduceMotion?: boolean;
  onPress?: () => void;
}) {
  const tab = (isSelected: boolean) => (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <TabBarButton
          icon="saved"
          label="Saved"
          accessibilityLabel="Saved, tab 3 of 4"
          selected={isSelected}
          onPress={onPress}
          testID="tab-saved"
        />
      </ReduceMotionProvider>
    </EditionProvider>
  );
  const view = await render(tab(selected));
  await act(async () => {
    await Promise.resolve();
  });
  return { select: (isSelected: boolean) => view.rerender(tab(isSelected)) };
}

/** How far the indicator has stretched in, and how visible it is. */
function indicator() {
  const style = getAnimatedStyle(screen.getByTestId('tab-saved-indicator')) as {
    opacity?: number;
    transform?: { scaleX?: number }[];
  };
  return {
    scaleX: style.transform?.find((step) => step.scaleX !== undefined)?.scaleX ?? 1,
    opacity: style.opacity ?? 1,
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('TabBarButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reads as a selected tab with its label and shows the indicator', async () => {
    await renderTab({ selected: true });

    const tab = screen.getByRole('tab', { name: 'Saved, tab 3 of 4' });
    expect(tab).toBeSelected();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(indicator().scaleX).toBe(1);
  });

  it('stretches the indicator in when the tab becomes selected', async () => {
    const { select } = await renderTab({ selected: false });
    expect(indicator().scaleX).toBe(0);
    expect(screen.getByRole('tab')).not.toBeSelected();

    await select(true);
    await wait(300);

    expect(indicator().scaleX).toBeCloseTo(1);
  });

  it('asks for the tab on a press', async () => {
    const onPress = jest.fn();
    await renderTab({ selected: false, onPress });

    await fireEvent.press(screen.getByRole('tab'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fades the indicator in without stretching under Reduce Motion', async () => {
    const { select } = await renderTab({ selected: false, reduceMotion: true });
    expect(indicator().opacity).toBe(0);

    await select(true);
    await wait(300);

    expect(indicator()).toEqual({ scaleX: 1, opacity: 1 });
  });
});
