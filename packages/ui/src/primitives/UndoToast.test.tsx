import { EditionProvider, UndoToastProvider, useUndoToast } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { testStrings } from '../test-strings';

/** Opens a toast with the message, and an undo when it has `onUndo`. */
function Opener({ message, onUndo }: { message: string; onUndo?: () => void }) {
  const show = useUndoToast();
  return (
    <Pressable
      testID={`open-${message}`}
      onPress={() => {
        show(onUndo === undefined ? { message } : { message, undoLabel: 'Undo', onUndo });
      }}
    >
      <Text>{message}</Text>
    </Pressable>
  );
}

async function renderOpeners(...openers: readonly { message: string; onUndo?: () => void }[]) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <UndoToastProvider>
        {openers.map((opener) => (
          <Opener key={opener.message} {...opener} />
        ))}
      </UndoToastProvider>
    </EditionProvider>,
  );
}

async function passTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('UndoToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('undoes what just happened and closes', async () => {
    const onUndo = jest.fn();
    await renderOpeners({ message: 'Hidden', onUndo });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Hidden');
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('leaves after 4 s', async () => {
    await renderOpeners({ message: 'Hidden', onUndo: jest.fn() });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await passTime(3999);
    expect(screen.queryByTestId('undo-toast')).not.toBeNull();
    await passTime(1);

    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('leaves no timer behind when its screen goes away', async () => {
    await renderOpeners({ message: 'Hidden', onUndo: jest.fn() });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await passTime(1000);
    await screen.unmount();
    // React Native's own short timers of the unmount run out; the toast's 3 s left must not stay.
    await passTime(1000);

    expect(jest.getTimerCount()).toBe(0);
  });

  it('takes the place of the toast before it', async () => {
    await renderOpeners(
      { message: 'Hidden', onUndo: jest.fn() },
      { message: 'Deleted', onUndo: jest.fn() },
    );

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await fireEvent.press(screen.getByTestId('open-Deleted'));

    expect(screen.getAllByTestId('undo-toast')).toHaveLength(1);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Deleted');
  });

  it('stays with VoiceOver on until the reader dismisses it', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await renderOpeners({ message: 'Hidden', onUndo: jest.fn() });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await passTime(10_000);
    expect(screen.queryByTestId('undo-toast')).not.toBeNull();
    await fireEvent(screen.getByTestId('undo-toast'), 'accessibilityEscape');

    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('says a message with no undo and leaves after 4 s', async () => {
    await renderOpeners({ message: 'Thanks' });

    await fireEvent.press(screen.getByTestId('open-Thanks'));
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Thanks');
    expect(screen.queryByRole('button')).toBeNull();
    await passTime(4000);

    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('leaves after 4 s with VoiceOver on when it has no undo to reach', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await renderOpeners({ message: 'Thanks' });

    await fireEvent.press(screen.getByTestId('open-Thanks'));
    await passTime(3999);
    expect(screen.queryByTestId('undo-toast')).not.toBeNull();
    await passTime(1);

    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });
});
