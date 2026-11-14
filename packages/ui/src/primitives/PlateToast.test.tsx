import type { Schedule } from '@slovo/core';
import { EditionProvider, UndoToastProvider, useUndoToast, type ToastContent } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

/** A Schedule the test runs by hand: what is waiting, and for how long. */
function handSchedule() {
  const waiting: { run: () => void; delay: number; cancelled: boolean }[] = [];
  const schedule: Schedule = (run, delay) => {
    const job = { run, delay, cancelled: false };
    waiting.push(job);
    return () => {
      job.cancelled = true;
    };
  };
  return {
    schedule,
    delays: () => waiting.filter((job) => !job.cancelled).map((job) => job.delay),
    runAll: async () => {
      await act(async () => {
        for (const job of waiting.filter((each) => !each.cancelled)) job.run();
        await Promise.resolve();
      });
    },
  };
}

function Opener({ toast }: { toast: ToastContent }) {
  const show = useUndoToast();
  return (
    <Pressable
      testID="open"
      onPress={() => {
        show(toast);
      }}
    >
      <Text>Open</Text>
    </Pressable>
  );
}

async function openToast(toast: ToastContent, schedule: Schedule) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <UndoToastProvider schedule={schedule}>
        <Opener toast={toast} />
      </UndoToastProvider>
    </EditionProvider>,
  );
  await fireEvent.press(screen.getByTestId('open'));
  await passTime(0);
}

async function passTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Where the toast is: how far below its place, and how opaque. */
function toastNow(): { below: number; opacity: number } {
  const style = getAnimatedStyle(screen.getByTestId('undo-toast')) as {
    transform?: { translateY?: number }[];
    opacity?: number;
  };
  return { below: style.transform?.[0]?.translateY ?? 0, opacity: style.opacity ?? 1 };
}

function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
}

describe('the plate toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('says its message and hides after 3.2 s', async () => {
    const clock = handSchedule();
    await openToast({ look: 'plate', message: 'Link copied.' }, clock.schedule);

    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Link copied.');
    expect(screen.queryByRole('button')).toBeNull();
    expect(clock.delays()).toEqual([3200]);
    await clock.runAll();

    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('rises 30 pt as it fades in over 0.4 s', async () => {
    reduceMotion(false);
    await openToast({ look: 'plate', message: 'Renamed.' }, handSchedule().schedule);

    expect(toastNow()).toEqual({ below: 30, opacity: 0 });
    await passTime(400);

    expect(toastNow()).toEqual({ below: 0, opacity: 1 });
  });

  it('fades in place under Reduce Motion', async () => {
    reduceMotion(true);
    await openToast({ look: 'plate', message: 'Renamed.' }, handSchedule().schedule);

    expect(toastNow()).toEqual({ below: 0, opacity: 0 });
    await passTime(1000);

    expect(toastNow()).toEqual({ below: 0, opacity: 1 });
  });

  it('runs its action once and closes', async () => {
    const onPress = jest.fn();
    const clock = handSchedule();
    await openToast(
      { look: 'plate', message: 'Deleted.', action: { label: 'Undo', onPress } },
      clock.schedule,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('undo-toast')).toBeNull();
    expect(clock.delays()).toEqual([]);
  });

  it('keeps its action in reach while VoiceOver is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const clock = handSchedule();
    await openToast(
      { look: 'plate', message: 'Deleted.', action: { label: 'Undo', onPress: jest.fn() } },
      clock.schedule,
    );

    await passTime(5000);

    expect(clock.delays()).toEqual([]);
    expect(toastNow().opacity).toBe(1);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeOnTheScreen();
  });
});
