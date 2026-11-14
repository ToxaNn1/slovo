import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { seedUserState } from '@slovo/core/testing';
import { StreakBreakScreen } from './streak-break-screen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The Break screen over the Core's composition of a test Shell, as the UA Edition ships it. */
async function renderScreen(seed: Parameters<typeof seedUserState>[0] = {}) {
  const userState = opened(
    await seedUserState(seed, {
      clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    }),
  );
  const composition = await testShell({ userState }).composition.opened();
  await renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <StreakBreakScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

const strings = editionStrings.settings.streakBreak;

/** A Break of `days` from `date`, as the XP log keeps it. */
const breakFrom = (date: string, days: number) => ({
  xpLog: { breakRecord: { kind: 'break' as const, date, at: `${date}T05:00:00.000Z`, days } },
});

describe('the Break screen', () => {
  it('steps its length between 1 and 7 and starts a Break of the length chosen', async () => {
    const composition = await renderScreen();
    expect(screen.getByText(strings.explanation)).toBeOnTheScreen();
    const value = () => screen.getByTestId('streak-break-days-value');
    expect(value()).toHaveTextContent('7');
    expect(screen.queryByTestId('streak-break-running')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-waiting')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText(strings.moreDays));
    expect(value()).toHaveTextContent('7');
    for (let press = 0; press < 7; press += 1) {
      await fireEvent.press(screen.getByLabelText(strings.fewerDays));
    }
    expect(value()).toHaveTextContent('1');
    await fireEvent.press(screen.getByLabelText(strings.moreDays));
    await fireEvent.press(screen.getByLabelText(strings.moreDays));

    await act(async () => {
      await fireEvent.press(screen.getByTestId('streak-break-start'));
      await Promise.resolve();
    });

    expect(composition.streakBreak.state.kind).toBe('running');
    expect([...composition.xpLog.days.breaks.values()]).toEqual([3]);
    expect(screen.getByTestId('streak-break-running')).toHaveTextContent(
      'Перерва триває до 15 жовтня включно.',
    );
    expect(screen.queryByTestId('streak-break-start')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-days')).not.toBeOnTheScreen();
  });

  it('while a Break runs, shows its last day and when the next one can start', async () => {
    await renderScreen(breakFrom('2026-10-12', 3));
    expect(screen.getByTestId('streak-break-running')).toHaveTextContent(
      'Перерва триває до 14 жовтня включно.',
    );
    expect(screen.getByTestId('streak-break-waiting')).toHaveTextContent(
      /^Наступну перерву можна почати з \d+ \S+\.$/,
    );
    expect(screen.queryByTestId('streak-break-days')).not.toBeOnTheScreen();
  });

  it('after a Break, before the next one is allowed, shows only when it can start', async () => {
    await renderScreen(breakFrom('2026-10-01', 2));
    expect(screen.getByTestId('streak-break-waiting')).toHaveTextContent(
      /^Наступну перерву можна почати з \d+ \S+\.$/,
    );
    expect(screen.queryByTestId('streak-break-running')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-days')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-start')).not.toBeOnTheScreen();
  });
});
