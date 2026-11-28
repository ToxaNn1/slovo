import { EditionProvider, OverCardToasts, UndoToastProvider, useUndoToast } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';
import { entryCardFrame, space } from '../tokens';

/** Opens a toast with the message, and an undo when it has `onUndo`. */
function Opener({
  message,
  onUndo,
  brief,
}: {
  message: string;
  onUndo?: () => void;
  brief?: true;
}) {
  const show = useUndoToast();
  return (
    <Pressable
      testID={`open-${message}`}
      onPress={() => {
        show(
          onUndo !== undefined
            ? { message, undoLabel: 'Undo', onUndo }
            : brief === undefined
              ? { message }
              : { message, brief },
        );
      }}
    >
      <Text>{message}</Text>
    </Pressable>
  );
}

async function renderOpeners(
  ...openers: readonly { message: string; onUndo?: () => void; brief?: true }[]
) {
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

/** Where the toast is: how far left of its place, and how opaque. */
function toastNow(): { left: number; opacity: number } {
  const style = getAnimatedStyle(screen.getByTestId('undo-toast')) as {
    transform?: { translateX?: number }[];
    opacity?: number;
  };
  return { left: -(style.transform?.[0]?.translateX ?? 0), opacity: style.opacity ?? 1 };
}

function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
}

describe('UndoToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("raised by an Entry card's action spans the card and stays clear of its tab bar", async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <UndoToastProvider>
          <OverCardToasts>
            <Opener message="Marked" onUndo={jest.fn()} />
          </OverCardToasts>
          <Opener message="Folded" onUndo={jest.fn()} />
        </UndoToastProvider>
      </EditionProvider>,
    );

    await fireEvent.press(screen.getByTestId('open-Marked'));
    // The card's own inset on its page, from edge to edge of its outline,
    // above the page's bottom air, the card's bottom padding and its tab bar.
    expect(screen.getByTestId('undo-toast')).toHaveStyle({
      left: space[3],
      right: space[3],
      bottom: space[6] + entryCardFrame.padding.bottom + entryCardFrame.tabBar.height + space[2],
    });

    // Review 1128 (5): a page with no card, as the Weekly Recap's, keeps the usual place.
    await fireEvent.press(screen.getByTestId('open-Folded'));
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Folded');
    expect(screen.getByTestId('undo-toast')).toHaveStyle({
      left: space[3] + 2,
      right: space[3] + 2,
      bottom: space[8] + space[2],
    });
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

  it('slides in from the left and stays shown', async () => {
    reduceMotion(false);
    await renderOpeners({ message: 'Hidden', onUndo: jest.fn() });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await passTime(0);
    expect(toastNow().left).toBeGreaterThan(0);
    await passTime(1000);

    expect(toastNow()).toEqual({ left: 0, opacity: 1 });
    await passTime(4000);
    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('fades in place under Reduce Motion, and still leaves after 4 s', async () => {
    reduceMotion(true);
    await renderOpeners({ message: 'Hidden', onUndo: jest.fn() });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await passTime(0);
    expect(toastNow()).toEqual({ left: 0, opacity: 0 });
    await passTime(1000);

    expect(toastNow()).toEqual({ left: 0, opacity: 1 });
    await passTime(4000);
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

  it('still comes in and leaves after 4 s when the screen reader check fails', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockRejectedValue(new Error('no answer'));
    await renderOpeners({ message: 'Hidden', onUndo: jest.fn() });

    await fireEvent.press(screen.getByTestId('open-Hidden'));
    await passTime(1000);
    expect(toastNow()).toEqual({ left: 0, opacity: 1 });
    await passTime(3000);

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

  it('leaves after 2.2 s when its message is brief', async () => {
    await renderOpeners({ message: 'Marked', brief: true });

    await fireEvent.press(screen.getByTestId('open-Marked'));
    await passTime(2100);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked');
    await passTime(100);

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
