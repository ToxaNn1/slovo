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

describe('the Games boards’ Lives and time', () => {
  it('ends «Виживання» on the third mistake with its 3 Lives', async () => {
    await open({ corrections: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-survival'));
    await waitFor(() => {
      expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 3 з 3');
    });
    for (const right of [true, false, false, false]) {
      await answerSurvivalRound(right);
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-lives-over')).toBeOnTheScreen();
    });
    expect(screen.getByText('1 з 4 влучань')).toBeOnTheScreen();
  });

  describe('«На час»', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-10-26T09:00:00Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Starts «На час» with the faked system time, which the faked timers move and the timer reads too. */
    async function startTimed() {
      await open({
        clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
        schedule: systemSchedule,
      });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-timed'));
    }

    it('runs 60 seconds and goes straight to «Фініш» once they are up', async () => {
      await startTimed();
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилося 60 секунд');
      });
      expect(screen.getByTestId('game-timer')).toHaveTextContent('60 с');
      await pickTheWordOfThePrompt();
      await pass(5_000);
      expect(screen.getByTestId('game-timer')).toHaveTextContent('55 с');
      expect(timerLabel()).toBe('лишилося 55 секунд');
      await pass(54_000);

      expect(screen.getByTestId('game-round')).toBeOnTheScreen();

      await pass(1_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
      expect(screen.getByText('ФІНІШ')).toBeOnTheScreen();
      expect(screen.queryByText('ЧАС!')).toBeNull();
      expect(screen.getByText('1 з 1 влучання')).toBeOnTheScreen();
    });
  });
});
