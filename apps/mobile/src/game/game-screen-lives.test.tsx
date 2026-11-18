import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { systemSchedule } from '@slovo/ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  open,
  renderScreen,
  answerSurvivalRound,
  pickTheWordOfThePrompt,
  timerLabel,
  pass,
  resetGameScreen,
} from './test-support';

beforeEach(resetGameScreen);

describe('the Games boards’ Lives and time (ADR 0137)', () => {
  it('ends «Виживання» on the first mistake with its 1 Life', async () => {
    await open({ corrections: 15, switchedOn: ['survivalOneLife'] });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-survival'));
    await waitFor(() => {
      expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 1 з 1');
    });
    await answerSurvivalRound(true);
    await fireEvent.press(screen.getByTestId('game-next'));
    await answerSurvivalRound(false);
    await fireEvent.press(screen.getByTestId('game-next'));

    await waitFor(() => {
      expect(screen.getByText('Життя закінчилися')).toBeOnTheScreen();
    });
    expect(screen.getByTestId('game-result-rounds').props['accessibilityLabel']).toBe(
      'Пройдено раундів: 1',
    );
  });

  describe('«На час»', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-10-26T09:00:00Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Starts «На час» with the faked system time, which the faked timers move and the timer reads too. */
    async function startTimed(switchedOn: readonly string[]) {
      await open({
        clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
        schedule: systemSchedule,
        switchedOn: ['finishPoster', ...switchedOn],
      });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-timed'));
    }

    it('runs 20 seconds and goes straight to «Фініш» once they are up', async () => {
      await startTimed(['timedTwentySeconds']);
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилось 20 секунд');
      });
      expect(screen.getByTestId('game-timer')).toHaveTextContent('20 с');
      await pickTheWordOfThePrompt();
      await pass(5_000);
      expect(screen.getByTestId('game-timer')).toHaveTextContent('15 с');
      expect(timerLabel()).toBe('лишилось 15 секунд');
      await pass(14_000);

      expect(screen.getByTestId('game-round')).toBeOnTheScreen();

      await pass(1_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
      expect(screen.getByText('ФІНІШ')).toBeOnTheScreen();
      expect(screen.queryByText('ЧАС!')).toBeNull();
      expect(screen.getByText('1 з 1 влучання')).toBeOnTheScreen();
    });

    it('runs 60 seconds and heads the poster «Час!» with timedTwentySeconds off', async () => {
      await startTimed([]);
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилось 60 секунд');
      });
      await pass(60_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
      expect(screen.getByText('ЧАС!')).toBeOnTheScreen();
      expect(screen.queryByText('ФІНІШ')).toBeNull();
    });
  });
});
