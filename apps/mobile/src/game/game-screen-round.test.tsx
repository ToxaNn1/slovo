import { beforeEach, describe, expect, it } from '@jest/globals';
import { coreTokens, typeStyle } from '@slovo/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { edition } from '../edition/edition';
import {
  open,
  renderScreen,
  answerSurvivalRound,
  theNumberOfThePrompt,
  theOption,
  resetGameScreen,
} from './test-support';

beforeEach(resetGameScreen);

describe('the Game screen', () => {
  it('heads a Round with its mode’s title, the Round in play and the Lives, and loses a Life to a wrong answer', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
    await waitFor(() => {
      expect(screen.getByRole('header', { name: 'Вгадай слово · 1/15' })).toBeOnTheScreen();
    });
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 5 з 5');
    expect(screen.queryByText(/Життів/)).toBeNull();
    expect(screen.getAllByTestId(/^game-life-\d+$/, { includeHiddenElements: true })).toHaveLength(
      5,
    );

    const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
    const n = /\d+/.exec(prompt)?.[0] ?? '';
    const wrong = screen
      .getAllByRole('button', { name: /^слово\d+,/ })
      .find((one) => !String(one.props['accessibilityLabel']).startsWith(`слово${n},`));
    if (wrong === undefined) throw new Error(`No wrong option for «${prompt}»`);
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
    expect(screen.getAllByTestId(/^game-life-\d+$/, { includeHiddenElements: true })).toHaveLength(
      5,
    );
    await fireEvent.press(screen.getByTestId('game-next'));
    await waitFor(() => {
      expect(screen.getByRole('header', { name: 'Вгадай слово · 2/15' })).toBeOnTheScreen();
    });
  });

  it('keys the options А–Г and marks a wrong pick with ✕ on its key', async () => {
    await open({ anglicisms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anglicism'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });
    const options = screen.getAllByTestId(/^game-option-\d+$/);
    options.forEach((option, place) => {
      expect(within(option).getByText(['А', 'Б', 'В', 'Г'][place] ?? '')).toBeTruthy();
    });
    expect(screen.queryByTestId(/^game-option-\d+-wrong-mark$/)).toBeNull();

    const standard = `добре${String(theNumberOfThePrompt())}`;
    const wrong = options.findIndex((option) => option.props['accessibilityLabel'] !== standard);
    const picked = options[wrong];
    if (picked === undefined) throw new Error('No wrong option');
    await fireEvent.press(picked);

    expect(screen.getAllByTestId(/^game-option-\d+-wrong-mark$/)).toHaveLength(1);
    expect(screen.getByTestId(`game-option-${String(wrong)}-wrong-mark`)).toBeTruthy();
    expect(theOption(`${standard}, Правильно`)).toBeTruthy();
  });

  it.each([
    ['a Word', { anglicisms: 15 }, 'game-mode-anglicism', 'roundOptionWord'],
    ['a sentence', { idioms: 15 }, 'game-mode-idiom-meaning', 'roundOptionSentence'],
    ['a long text', { idioms: 15, longSenses: true }, 'game-mode-idiom-meaning', 'roundOptionLong'],
  ] as const)(
    'sizes the options for their text when each is %s',
    async (_, content, mode, role) => {
      await open(content);
      await renderScreen();

      await fireEvent.press(screen.getByTestId(mode));
      await waitFor(() => {
        expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      });
      const { fontSize } = typeStyle(role, coreTokens);
      screen.getAllByTestId(/^game-option-\d+$/).forEach((option) => {
        const text = String(option.props['accessibilityLabel']);
        expect(within(option).getByText(text)).toHaveStyle({ fontSize });
      });
    },
  );

  it('shows the streak of «Виживання» with its switch on, a big counter and «{n} поспіль · рекорд {best}» from the Best result, in place of the Rounds passed', async () => {
    await open({ corrections: 15, best: { survival: 2 }, switchedOn: ['survivalStreak'] });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-survival'));

    const lines: string[] = [];
    for (let round = 1; round <= 4; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-streak-rounds')).toHaveTextContent(String(round - 1));
      });
      lines.push(String(screen.getByTestId('game-streak').props['accessibilityLabel']));
      expect(screen.queryByTestId('game-progress')).toBeNull();
      await answerSurvivalRound(round !== 2);
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    expect(lines).toEqual([
      '0 поспіль · рекорд 2',
      '1 поспіль · рекорд 2',
      '2 поспіль · рекорд 2',
      '3 поспіль · рекорд 3',
    ]);
    expect(screen.getByTestId('game-streak-line')).toHaveTextContent('4 поспіль · рекорд 4');
  });

  it('asks before leaving a Game in the Edition’s words: «Грати далі» plays on, «Вийти» leaves', async () => {
    await open({ corrections: 15 });
    await renderScreen();
    await fireEvent.press(screen.getByTestId('game-mode-type-word'));
    await waitFor(() => {
      expect(screen.getByTestId('game-round')).toBeOnTheScreen();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Вийти з гри' }));
    expect(screen.getByText('Вийти з гри?')).toBeOnTheScreen();
    expect(screen.getByText('Пройдені раунди пропадуть, а рекорд не оновиться.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Грати далі' }));
    await waitFor(() => {
      expect(
        screen.queryByText('Пройдені раунди пропадуть, а рекорд не оновиться.'),
      ).not.toBeOnTheScreen();
    });
    expect(screen.getByTestId('game-round')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Вийти з гри' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Вийти' }));
    await waitFor(() => {
      expect(screen.queryByTestId('game-round')).not.toBeOnTheScreen();
    });
    expect(screen.getByTestId('game-mode-type-word')).toBeOnTheScreen();
  });

  describe('the Mascot (#1386)', () => {
    const { mascot } = edition;

    it('stays out of the Round, which board 07 draws without it, and meets the Game’s end with the Edition’s line', async () => {
      await open({ corrections: 15 });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-survival'));
      expect(screen.getByRole('header', { name: 'Виживання' })).toBeOnTheScreen();
      expect(screen.queryByTestId(/^mascot-/)).toBeNull();

      await answerSurvivalRound(true);
      expect(screen.queryByTestId(/^mascot-/)).toBeNull();
      await fireEvent.press(screen.getByTestId('game-next'));

      for (let mistake = 1; mistake <= 3; mistake += 1) {
        await waitFor(() => {
          expect(screen.getByTestId('game-prompt')).toBeTruthy();
        });
        await answerSurvivalRound(false);
        expect(screen.queryByTestId(/^mascot-/)).toBeNull();
        await fireEvent.press(screen.getByTestId('game-next'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('mascot-gameEnd')).toHaveTextContent(mascot.gameEnd);
      });
    });

    it('stays out of the Game with its Feature Switch off, as in 0.9', async () => {
      await open({ corrections: 15, switchedOff: ['mascot'] });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-survival'));

      await answerSurvivalRound(true);
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      expect(screen.queryByTestId(/^mascot-/)).toBeNull();
    });
  });
});
