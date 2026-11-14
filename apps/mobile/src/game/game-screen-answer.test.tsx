import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { open, renderScreen, resetGameScreen } from './test-support';

beforeEach(resetGameScreen);

describe('the Game screen', () => {
  describe('the answer card', () => {
    it('answers in the sheet over the Round with «Влучно!» or «Майже. Наступне вийде.» and the Definition, «Далі →» moving on, and keeps the Example for the Game Review', async () => {
      await open({ switchedOn: ['gameAnswerCard'] });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-stress'));
      await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));

      expect(screen.getAllByTestId('game-answer-card')).toHaveLength(1);
      const card = within(screen.getByTestId('game-sheet')).getByTestId('game-answer-card');
      expect(within(card).getByRole('header')).toHaveTextContent('Влучно!');
      expect(within(card).getByTestId('game-answer-card-line')).toHaveTextContent(
        /^The meaning of test\d+\.$/,
      );
      expect(card).not.toHaveTextContent(/Речення/);

      await fireEvent.press(within(card).getByRole('button', { name: 'Далі →' }));

      await waitFor(() => {
        expect(screen.queryByTestId('game-answer-card')).toBeNull();
      });
      expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
        'Пройдено раундів: 1 з 15',
      );
      const wrong = screen
        .getAllByRole('button', { name: /^о, / })
        .find((vowel) => vowel.props['accessibilityLabel'] !== 'о, третя літера');
      if (wrong === undefined) throw new Error('No wrong vowel');
      await fireEvent.press(wrong);

      expect(within(screen.getByTestId('game-answer-card')).getByRole('header')).toHaveTextContent(
        'Майже. Наступне вийде.',
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Далі →' }));
      for (let round = 3; round <= 15; round += 1) {
        await waitFor(() => {
          expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
        });
        await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Далі →' }));
      }
      await waitFor(() => {
        expect(screen.getByTestId('game-review')).toBeOnTheScreen();
      });
      await fireEvent.press(screen.getByTestId('game-review-row-1'));

      expect(screen.getByTestId('game-review-details')).toHaveTextContent(/Речення \d+/);
    });

    it('keeps the bottom sheet with its switch off', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-stress'));
      await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));

      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      expect(screen.queryByTestId('game-answer-card')).toBeNull();
    });
  });
});
