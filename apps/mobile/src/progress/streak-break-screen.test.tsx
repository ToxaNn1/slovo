import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderApp } from '../shell/test-app';

import { editionStrings } from '../edition/edition';
import { opened, testShell } from '../shell/test-support';
import { seedUserState } from '@slovo/core/testing';
import { StreakBreakScreen } from './streak-break-screen';

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useRouter: () => ({ back: jest.fn() }),
}));

/** The Break screen over the Core's composition of a test Shell, as the UA Edition ships it. */
async function renderScreen(seed: Parameters<typeof seedUserState>[0] = {}) {
  const userState = opened(
    await seedUserState(seed, {
      clock: { now: () => new Date('2026-10-13T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    }),
  );
  const composition = await testShell({ userState }).composition.opened();
  await renderApp(<StreakBreakScreen />, {
    shell: testShell({ composition: opened(composition) }),
  });
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
    expect(screen.getByTestId('streak-break-most')).toHaveTextContent(strings.most);
    expect(screen.queryByTestId('streak-break-running')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-waiting')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText(strings.moreDays));
    expect(value()).toHaveTextContent('7');
    for (let press = 0; press < 7; press += 1) {
      await fireEvent.press(screen.getByLabelText(strings.fewerDays));
    }
    expect(value()).toHaveTextContent('1');
    expect(screen.queryByTestId('streak-break-most')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(strings.moreDays));
    await fireEvent.press(screen.getByLabelText(strings.moreDays));

    await act(async () => {
      await fireEvent.press(screen.getByTestId('streak-break-start'));
      await Promise.resolve();
    });

    expect(composition.streakBreak.state.kind).toBe('running');
    expect([...composition.xpLog.days.breaks.values()]).toEqual([3]);
    expect(screen.getByText('Перерва триває до 15 жовтня включно.')).toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-start')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-days')).not.toBeOnTheScreen();
  });

  it('while a Break runs, lays out its days left, last day and «Завершити перерву», then ends it early', async () => {
    const composition = await renderScreen(breakFrom('2026-10-12', 3));
    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('streak-break-running')).toBeOnTheScreen();
    expect(screen.getByText('ПЕРЕРВА')).toBeOnTheScreen();
    // 13 and 14 October, today included.
    expect(screen.getByTestId('streak-break-days-left')).toHaveTextContent('Лишилося 2 дні.');
    expect(screen.getByText('Перерва триває до 14 жовтня включно.')).toBeOnTheScreen();
    expect(screen.getByText('Наступну перерву можна почати з 11 листопада.')).toBeOnTheScreen();
    expect(screen.queryByText(strings.explanation)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-waiting')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-days')).not.toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: strings.end }));
      await Promise.resolve();
    });

    // 12 October was the one Break day used: 6 of the 7 come back.
    expect(composition.streakBreak.state).toEqual({ kind: 'available', longest: 6 });
    expect(screen.queryByTestId('streak-break-running')).not.toBeOnTheScreen();
    expect(screen.getByTestId('streak-break-days-value')).toHaveTextContent('6');
  });

  it('after a short Break, offers the days left of the 7', async () => {
    await renderScreen(breakFrom('2026-10-01', 2));
    expect(screen.getByTestId('streak-break-days-value')).toHaveTextContent('5');
    expect(screen.getByTestId('streak-break-most')).toHaveTextContent(
      'Більше не можна: на ці 30 днів лишилося 5 днів перерви.',
    );
    expect(screen.queryByTestId('streak-break-waiting')).not.toBeOnTheScreen();
  });

  it('once the 7 days are spent, before the next Break is allowed, shows only when it can start', async () => {
    await renderScreen(breakFrom('2026-10-01', 7));
    expect(screen.getByTestId('streak-break-waiting')).toHaveTextContent(
      'Наступну перерву можна почати з 31 жовтня.',
    );
    expect(screen.queryByTestId('streak-break-running')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-days')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-start')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-end')).not.toBeOnTheScreen();
  });
});
