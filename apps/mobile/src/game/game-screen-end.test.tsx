import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { editionStrings } from '../edition/edition';
import {
  composition,
  open,
  renderScreen,
  answerSurvivalRound,
  winStress,
  resetGameScreen,
} from './game-screen.test-support';

beforeEach(resetGameScreen);

describe('the Game screen', () => {
  describe('the end posters', () => {
    it('ends a whole «Наголос» on the «Фініш» poster, «Влучно!», with its XP and a new record, and «До ігор» opens the Games hub', async () => {
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
      expect(screen.getByText('Фініш')).toBeOnTheScreen();
      expect(screen.getByText('Влучно!')).toBeOnTheScreen();
      expect(screen.getByText('15 з 15 влучань')).toBeOnTheScreen();
      expect(screen.getByTestId('game-end-new-best')).toHaveTextContent('Новий рекорд!');
      expect(screen.getByTestId('game-end-xp')).toHaveTextContent(/^Досвід\d+ XP$/);
      expect(screen.queryByTestId('game-end-time-up')).toBeNull();
      expect(screen.getByTestId('game-end-best')).toHaveTextContent('Рекорд15');
      expect(screen.queryByText('Перемога!')).toBeNull();
      expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();

      await fireEvent.press(screen.getByTestId('game-to-games'));

      expect(screen.getByTestId('game-modes')).toBeOnTheScreen();
    });

    it('ends «Виживання» on its third mistake on the Lives-over poster, with the mode and the score', async () => {
      await open({ corrections: 15, switchedOn: ['finishPoster'] });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-survival'));
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
      expect(screen.getByText('Життя закінчилися')).toBeOnTheScreen();
      expect(screen.getByText('ВИЖИВАННЯ · 2/5')).toBeOnTheScreen();
      expect(screen.queryByTestId('game-end-xp')).toBeNull();
      expect(screen.getByTestId('game-again')).toHaveTextContent('Ще раз!');
      expect(screen.getByTestId('game-to-games')).toHaveTextContent('До ігор');
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
