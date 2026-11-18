import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { editionStrings } from '../edition/edition';
import {
  composition,
  mockRouted,
  open,
  renderScreen,
  answerSurvivalRound,
  winStress,
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
      await open({ switchedOn: ['finishPoster'] });
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
      expect(screen.queryByText('Перемога!')).toBeNull();
      expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
      // Off `gameEndToFeed` and `plainGameReview`, the two buttons and the Game Review of #1674 stay.
      expect(screen.queryByTestId('game-to-feed')).toBeNull();
      expect(screen.getByRole('header', { name: 'Твої раунди' })).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('game-to-games'));

      expect(screen.getByTestId('game-modes')).toBeOnTheScreen();
      expect(mockRouted).toEqual([]);
    });

    it('ends «Виживання» on its third mistake on «ФІНІШ» and «ЩЕ РАУНД!» with the tiles (board «slogo game last»)', async () => {
      await open({ corrections: 15, switchedOn: ['finishPoster'] });
      await renderScreen();

      await loseSurvival();

      expect(screen.getByText('ФІНІШ')).toBeOnTheScreen();
      expect(screen.getByText('ЩЕ РАУНД!')).toBeOnTheScreen();
      expect(screen.getByTestId('game-end-xp')).toBeOnTheScreen();
      expect(screen.queryByText('Життя закінчилися')).toBeNull();
      expect(screen.queryByText('Розминка!')).toBeNull();
      expect(screen.getByTestId('game-again')).toHaveTextContent('Ще раз!');
      expect(screen.getByTestId('game-to-games')).toHaveTextContent('До ігор');
      expect(screen.queryByTestId('game-to-feed')).toBeNull();
    });

    it('offers «Ще раз!» and «До ігор» one under the other and no «До стрічки», even with `gameEndToFeed` on (owner, 15.11)', async () => {
      await open({ corrections: 15, switchedOn: ['finishPoster', 'gameEndToFeed'] });
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
      await open({ corrections: 15, switchedOn: ['finishPoster', 'plainGameReview'] });
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

  describe('the widget hint', () => {
    it('shows the widget guide over the result of the first won Game, with its 3 steps, until «Зрозуміло» closes it', async () => {
      await renderScreen();

      await winStress();

      const sheet = await screen.findByTestId('widget-guide-sheet');
      expect(within(sheet).getByRole('header', { name: 'Слово на головному екрані' })).toBeTruthy();
      for (const [index, step] of editionStrings.widget.guide.steps.entries()) {
        expect(
          screen.getByTestId(`widget-guide-sheet-step-${String(index + 1)}`),
        ).toHaveTextContent(`${String(index + 1)}${step.title}${step.hint}`);
      }

      await fireEvent.press(screen.getByRole('button', { name: 'Зрозуміло' }));

      await waitFor(() => {
        expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
      });
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });

    it('keeps the widget guide as shown once it is on screen: a Game left from under it and the next won one offer none', async () => {
      await renderScreen();
      await winStress();
      expect(await screen.findByTestId('widget-guide-sheet')).toBeOnTheScreen();

      // Left without «Зрозуміло»: only the Core remembers that the hint was shown.
      await act(() => {
        composition.game.leave();
      });
      await winStress();

      expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
    });

    it('offers the widget guide once ever: the next won Game shows none', async () => {
      await renderScreen();
      await winStress();
      await fireEvent.press(await screen.findByRole('button', { name: 'Зрозуміло' }));
      await waitFor(() => {
        expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
      });

      await fireEvent.press(screen.getByTestId('game-again'));
      await winStress({ fromCard: false });

      expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
    });

    it('offers no widget guide with the widget switched off', async () => {
      await open({ switchedOff: ['widget'] });
      await renderScreen();

      await winStress();

      expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
    });
  });
});
