import type { Schedule } from '@slovo/core';
import { EditionProvider, OfflinePlateProvider, useOfflinePlate } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 50, left: 0, right: 0, bottom: 34 },
};

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

function Opener() {
  const show = useOfflinePlate();
  return (
    <Pressable testID="open" onPress={show}>
      <Text>Open</Text>
    </Pressable>
  );
}

async function renderPlate(schedule: Schedule) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <OfflinePlateProvider message="No connection. Try later." schedule={schedule}>
          <Opener />
        </OfflinePlateProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

async function passTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
}

/** How far above its place the plate is, as a share of its height. */
function plateLift(): number {
  const style = getAnimatedStyle(screen.getByTestId('offline-plate')) as {
    transform?: { translateY?: number }[];
  };
  return style.transform?.[0]?.translateY ?? 0;
}

describe('the offline plate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows nothing until asked', async () => {
    await renderPlate(handSchedule().schedule);

    expect(screen.queryByTestId('offline-plate')).toBeNull();
  });

  it('says there is no connection, under the status bar, as an alert, and hides after 3.2 s', async () => {
    const clock = handSchedule();
    await renderPlate(clock.schedule);

    await fireEvent.press(screen.getByTestId('open'));
    await passTime(0);

    const plate = screen.getByTestId('offline-plate');
    expect(screen.getByRole('alert', { name: 'No connection. Try later.' })).toBeOnTheScreen();
    expect(screen.getByText('No connection. Try later.')).toBeOnTheScreen();
    expect(plate).toHaveStyle({ top: 56 });
    expect(clock.delays()).toEqual([3200]);
    await clock.runAll();

    expect(screen.queryByTestId('offline-plate')).toBeNull();
  });

  it('drops in from above over 0.4 s', async () => {
    reduceMotion(false);
    await renderPlate(handSchedule().schedule);

    await fireEvent.press(screen.getByTestId('open'));
    await passTime(0);
    expect(plateLift()).toBeLessThan(0);
    await passTime(400);

    expect(plateLift()).toBe(0);
  });

  it('stands in place at once under Reduce Motion', async () => {
    reduceMotion(true);
    await renderPlate(handSchedule().schedule);

    await fireEvent.press(screen.getByTestId('open'));
    await passTime(0);

    expect(plateLift()).toBe(0);
  });

  it('shows once more for a second ask, with its time started again', async () => {
    const clock = handSchedule();
    await renderPlate(clock.schedule);

    await fireEvent.press(screen.getByTestId('open'));
    await passTime(0);
    await fireEvent.press(screen.getByTestId('open'));
    await passTime(0);

    expect(screen.getAllByTestId('offline-plate')).toHaveLength(1);
    expect(clock.delays()).toEqual([3200]);
  });

  it('reads its message out for VoiceOver once, on iOS too, where a view that appears is not read', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
    announce.mockClear();
    await renderPlate(handSchedule().schedule);

    await fireEvent.press(screen.getByTestId('open'));
    await passTime(0);

    expect(announce.mock.calls).toEqual([['No connection. Try later.']]);
    announce.mockRestore();
  });
});
