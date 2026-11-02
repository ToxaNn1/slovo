import { Button, EditionProvider, IconButton, PressedTile } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

function Edition({ children }: { children: ReactNode }) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {children}
    </EditionProvider>
  );
}

type Draw = (onPress: () => void, disabled?: boolean) => ReactNode;

const pressables: [string, Draw][] = [
  [
    'PressedTile',
    (onPress: () => void, disabled = false) => (
      <PressedTile testID="it" accessibilityLabel="Go" onPress={onPress} disabled={disabled}>
        <Text>Go</Text>
      </PressedTile>
    ),
  ],
  ...(['primary', 'neutral', 'onAccent', 'ghost'] as const).map(
    (variant) =>
      [
        `Button ${variant}`,
        (onPress: () => void, disabled = false) => (
          <Button testID="it" variant={variant} label="Go" onPress={onPress} disabled={disabled} />
        ),
      ] satisfies [string, Draw],
  ),
];

/** Where the face of the tile is, after the press has run its course. */
async function face() {
  await act(() => {
    jest.advanceTimersByTime(1000);
  });
  const style = getAnimatedStyle(screen.getByTestId('it-face')) as {
    opacity: number;
    transform: { translateY: number }[];
  };
  return { opacity: style.opacity, sunk: style.transform[0]?.translateY ?? 0 };
}

async function renderWith(reduceMotion: boolean, node: ReactNode) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(<Edition>{node}</Edition>);
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe.each(pressables)('%s', (name, draw) => {
  const sinks = !name.includes('ghost');

  it('rests with its face up and acts on a press', async () => {
    const onPress = jest.fn();
    await renderWith(false, draw(onPress));

    expect(await face()).toEqual({ opacity: 1, sunk: 0 });
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it(sinks ? 'sinks onto its edge while pressed' : 'fades while pressed', async () => {
    await renderWith(false, draw(jest.fn()));

    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressIn');

    expect(await face()).toEqual(sinks ? { opacity: 1, sunk: 4 } : { opacity: 0.7, sunk: 0 });
    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressOut');
    expect(await face()).toEqual({ opacity: 1, sunk: 0 });
  });

  it('fades in place of sinking under Reduce Motion', async () => {
    await renderWith(true, draw(jest.fn()));

    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressIn');

    expect(await face()).toEqual({ opacity: 0.7, sunk: 0 });
  });

  it('takes no press while it is disabled', async () => {
    const onPress = jest.fn();
    await renderWith(false, draw(onPress, true));

    const button = screen.getByRole('button', { name: 'Go' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});

describe('Button', () => {
  it('shows that it is busy and takes no press until its request is answered', async () => {
    const onPress = jest.fn();
    await renderWith(false, <Button label="Send the code" onPress={onPress} busy />);

    const button = screen.getByRole('button', { name: 'Send the code' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
  });

  it('says which of a choice is chosen', async () => {
    await renderWith(false, <Button label="Known" onPress={jest.fn()} selected />);

    expect(screen.getByRole('button', { name: 'Known' })).toBeSelected();
  });
});

describe('IconButton', () => {
  it('acts on a press under its label and takes none while disabled', async () => {
    const onPress = jest.fn();
    await renderWith(false, <IconButton icon="back" accessibilityLabel="Back" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await renderWith(
      false,
      <IconButton icon="close" accessibilityLabel="Close" onPress={onPress} disabled />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
