import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  mockRouted,
  open,
  renderScreen,
  answerSurvivalRound,
  resetGameScreen,
} from './test-support';

beforeEach(resetGameScreen);

/** Plays «Виживання» to its third mistake, two of its five Rounds right, from its card unless the Game is in play. */
async function loseSurvival({ fromCard = true } = {}) {
  if (fromCard) await fireEvent.press(screen.getByTestId('game-mode-survival'));
  for (const right of [false, true, true, false, false]) {
    await waitFor(() => {
      expect(screen.getByTestId('game-lives')).toBeOnTheScreen();
    });
    await answerSurvivalRound(right);
    await fireEvent.press(screen.getByTestId('game-next'));
  }
  await waitFor(() => {
    expect(screen.getByTestId('game-end-lives-over')).toBeOnTheScreen();
  });
}

describe('the Game screen', () => {
  describe('the end posters', () => {
    it('ends a whole «Наголос» on «ФІНІШ», «ВЛУЧНО!», with its XP, the new record stamp and the glad Mascot, and «До ігор» opens the Games hub', async () => {
      await open({});
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-stress'));
      for (let round = 1; round <= 15; round += 1) {
        await waitFor(() => {
          expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
        });
        await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
        await fireEvent.press(screen.getByTestId('game-next'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
      });
      expect(screen.getByText('ФІНІШ')).toBeOnTheScreen();
      expect(screen.getByText('ВЛУЧНО!')).toBeOnTheScreen();
      expect(screen.getByText('15 з 15 влучань')).toBeOnTheScreen();
      expect(screen.getByTestId('game-end-new-best')).toHaveTextContent('НОВИЙ РЕКОРД!');
      expect(screen.getByTestId('game-end-xp')).toHaveTextContent(/^Досвід\+\d+ XP$/);
      expect(screen.getByTestId('mascot-happy')).toBeTruthy();
      expect(screen.queryByTestId('game-end-time-up')).toBeNull();
      expect(screen.getByTestId('game-end-best')).toHaveTextContent('Рекорд15');
      // Off `gameEndToFeed` and `plainGameReview`, the two buttons and the Game Review of #1674 stay.
      expect(screen.queryByTestId('game-to-feed')).toBeNull();
      expect(screen.getByRole('header', { name: 'Твої раунди' })).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('game-to-games'));

      expect(screen.getByTestId('game-modes')).toBeOnTheScreen();
      expect(mockRouted).toEqual([]);
    });

    it('ends «Виживання» on its third mistake on «ФІНІШ» and «ЩЕ РАУНД!» with the tiles (board «slogo game last»)', async () => {
      await open({ corrections: 15 });
      await renderScreen();

      await loseSurvival();

      expect(screen.getByText('ФІНІШ')).toBeOnTheScreen();
      expect(screen.getByText('ЩЕ РАУНД!')).toBeOnTheScreen();
      expect(screen.getByTestId('game-end-xp')).toBeOnTheScreen();
      expect(screen.queryByText('Розминка!')).toBeNull();
      expect(screen.getByTestId('game-again')).toHaveTextContent('Ще раз!');
      expect(screen.getByTestId('game-to-games')).toHaveTextContent('До ігор');
      expect(screen.queryByTestId('game-to-feed')).toBeNull();
    });

    it('offers «Ще раз!» and «До ігор» one under the other and no «До стрічки», even with `gameEndToFeed` on (owner, 15.11)', async () => {
      await open({ corrections: 15, switchedOn: ['gameEndToFeed'] });
      await renderScreen();
      await loseSurvival();
      expect(screen.getByTestId('game-again')).toHaveTextContent('Ще раз!');
      expect(screen.getByTestId('game-to-games')).toHaveTextContent('До ігор');
      expect(screen.queryByTestId('game-to-feed')).toBeNull();
      expect(screen.queryByText('До стрічки')).toBeNull();

      await fireEvent.press(screen.getByTestId('game-again'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: 'Виживання' })).toBeOnTheScreen();
      });
      expect(screen.queryByTestId('game-end-lives-over')).toBeNull();

      await loseSurvival({ fromCard: false });
      await fireEvent.press(screen.getByTestId('game-to-games'));

      expect(screen.getByTestId('game-modes')).toBeOnTheScreen();
    });

    it('lists «Огляд раундів», a plain row for each Round whose tap does nothing', async () => {
      await open({ corrections: 15, switchedOn: ['plainGameReview'] });
      await renderScreen();
      await loseSurvival();

      expect(screen.getByRole('header', { name: 'Огляд раундів' })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: 'Твої раунди' })).toBeNull();
      const rows = screen.getAllByTestId(/^game-review-row-/);
      expect(rows.map((row) => String(row.props['accessibilityLabel']).split(', ').at(-1))).toEqual(
        ['помилка', 'правильно', 'правильно', 'помилка', 'помилка'],
      );
      const [first] = rows;
      if (first === undefined) throw new Error('No row');
      const before = screen.toJSON();

      await fireEvent.press(first);

      expect(screen.toJSON()).toEqual(before);
      expect(mockRouted).toEqual([]);
    });
  });
});
