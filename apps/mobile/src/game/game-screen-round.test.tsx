import { beforeEach, describe, expect, it } from '@jest/globals';
import { coreTokens, typeStyle } from '@slovo/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { edition } from '../edition/edition';
import {
  open,
  renderScreen,
  answerSurvivalRound,
  pickTheWordOfThePrompt,
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
    await open({ corrections: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-correction'));
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
    ['a Word', { corrections: 15 }, 'game-mode-correction', 'roundOptionWord'],
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

  describe('the Round on the ground (gameQuestionOnGround, gameRoundMascot)', () => {
    const BOARD = ['gameQuestionOnGround', 'gameRoundMascot'];
    const HIDDEN = { includeHiddenElements: true };
    const livesLine = () => String(screen.getByTestId('game-lives-line').props['children']);

    /** Picks a wrong option in a Round of «Вгадай слово». */
    async function pickAWrongWord() {
      const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
      const n = /\d+/.exec(prompt)?.[0] ?? '';
      const wrong = screen
        .getAllByRole('button', { name: /^слово\d+,/ })
        .find((one) => !String(one.props['accessibilityLabel']).startsWith(`слово${n},`));
      if (wrong === undefined) throw new Error(`No wrong option for «${prompt}»`);
      await fireEvent.press(wrong);
    }

    it('heads a Round with the mode’s name alone and shows «Життів: n з N» under the bar, one less after a wrong answer', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: 'Вгадай слово' })).toBeOnTheScreen();
      });
      expect(screen.queryByText(/Вгадай слово · /)).toBeNull();
      const [, before = '', total = ''] = /^Життів: (\d+) з (\d+)$/.exec(livesLine()) ?? [];
      expect(before).toBe(total);
      expect(screen.getByText(`Життів: ${total} з ${total}`)).toBeOnTheScreen();

      await pickAWrongWord();

      expect(livesLine()).toBe(`Життів: ${String(Number(total) - 1)} з ${total}`);
    });

    it('shows no Lives line in «На час», which has no Lives', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-timed'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: 'На час' })).toBeOnTheScreen();
      });
      expect(screen.queryByTestId('game-lives-line')).toBeNull();
      expect(screen.queryByText(/Життів/)).toBeNull();
    });

    it('labels the question without the Round’s number', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
      await waitFor(() => {
        expect(screen.getByText('Визначення', HIDDEN)).toBeOnTheScreen();
      });
      expect(screen.queryByText(/ · \d+ \/ \d+$/, HIDDEN)).toBeNull();
    });

    it('draws no red label over the question of «Звідки слово», which the board heads in ink', async () => {
      await open({ origins: 15, switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-origin'));
      await waitFor(() => {
        expect(screen.getByTestId('game-prompt')).toBeOnTheScreen();
      });
      expect(screen.queryByText(/Звідки це слово\?/, HIDDEN)).toBeNull();
    });

    it('keeps the #1674 Round with its switch off: the number in the header and the label, no Lives line', async () => {
      await open({ origins: 15, switchedOn: ['gameRoundMascot'] });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-origin'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: /^Звідки слово · 1\/\d+$/ })).toBeOnTheScreen();
      });
      expect(screen.getByText(/^Звідки це слово\? · 1 \/ \d+$/, HIDDEN)).toBeOnTheScreen();
      expect(screen.queryByTestId('game-lives-line')).toBeNull();
    });

    it('sets the Mascot beside the question: waiting, glad at a right answer, wincing at a wrong one', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
      await waitFor(() => {
        expect(screen.getByTestId('mascot-waits')).toBeOnTheScreen();
      });

      await pickTheWordOfThePrompt();
      expect(screen.getByTestId('mascot-happy')).toBeOnTheScreen();
      expect(screen.queryByTestId('mascot-waits')).toBeNull();
      await fireEvent.press(screen.getByTestId('game-next'));
      await waitFor(() => {
        expect(screen.getByTestId('mascot-waits')).toBeOnTheScreen();
      });

      await pickAWrongWord();
      expect(screen.getByTestId('mascot-cringes')).toBeOnTheScreen();
    });

    it('makes the Mascot sad when the last Life is lost', async () => {
      await open({ corrections: 15, switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-survival'));
      for (;;) {
        await waitFor(() => {
          expect(screen.getByTestId('game-prompt')).toBeTruthy();
        });
        await answerSurvivalRound(false);
        if (livesLine().startsWith('Життів: 0 ')) break;
        expect(screen.getByTestId('mascot-cringes')).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId('game-next'));
      }
      expect(screen.getByTestId('mascot-sad')).toBeOnTheScreen();
    });

    it('keeps the Mascot out of the Round with its switch off', async () => {
      await open({ switchedOn: ['gameQuestionOnGround'] });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
      await waitFor(() => {
        expect(screen.getByTestId('game-prompt')).toBeOnTheScreen();
      });
      expect(screen.queryByTestId(/^mascot-/)).toBeNull();
    });
  });

  describe('the board’s options (gameOptionStamp)', () => {
    const KEYS = ['А', 'Б', 'В', 'Г'];
    const optionsShown = () => screen.getAllByTestId(/^game-option-\d+$/);
    const labelOf = (option: ReturnType<typeof optionsShown>[number]) =>
      String(option.props['accessibilityLabel']);

    async function play(mode: string) {
      await renderScreen();
      await fireEvent.press(screen.getByTestId(mode));
      await waitFor(() => {
        expect(optionsShown()).toHaveLength(4);
      });
    }

    it('draws a short option large and without a key, and stamps the right one with ✓', async () => {
      await open({ corrections: 15, switchedOn: ['gameOptionStamp'] });
      await play('game-mode-correction');

      const { fontSize } = typeStyle('roundOptionWord', coreTokens);
      optionsShown().forEach((option) => {
        KEYS.forEach((key) => {
          expect(within(option).queryByText(key)).toBeNull();
        });
        expect(within(option).getByText(labelOf(option))).toHaveStyle({ fontSize });
      });
      expect(screen.queryByTestId(/^game-option-\d+-stamp$/)).toBeNull();

      const standard = `добре${String(theNumberOfThePrompt())}`;
      const right = optionsShown().findIndex((option) => labelOf(option) === standard);
      await fireEvent.press(screen.getByTestId(`game-option-${String(right)}`));

      expect(theOption(`${standard}, Правильно`)).toBeTruthy();
      expect(screen.getAllByTestId(/^game-option-\d+-stamp$/)).toHaveLength(1);
      expect(screen.getByTestId(`game-option-${String(right)}-stamp`)).toBeTruthy();
      expect(screen.queryByTestId(/^game-option-\d+-(right|wrong)-mark$/)).toBeNull();
    });

    it('keys a long option А–Г and, after a wrong pick, puts ✓ in the right one’s key, and crosses the wrong one out with ✕ in its key', async () => {
      await open({ idioms: 15, switchedOn: ['gameOptionStamp'] });
      await play('game-mode-idiom-meaning');

      optionsShown().forEach((option, place) => {
        expect(within(option).getByText(KEYS[place] ?? '')).toBeTruthy();
      });
      const standard = `The sense of idiom${String(theNumberOfThePrompt())}.`;
      const right = optionsShown().findIndex((option) => labelOf(option) === standard);
      const wrong = optionsShown().findIndex((option) => labelOf(option) !== standard);
      const picked = optionsShown()[wrong];
      if (picked === undefined) throw new Error('No wrong option');
      await fireEvent.press(picked);

      expect(screen.getByTestId(`game-option-${String(right)}-right-mark`)).toBeTruthy();
      expect(screen.getByTestId(`game-option-${String(wrong)}-wrong-mark`)).toBeTruthy();
      expect(screen.queryByTestId(/^game-option-\d+-stamp$/)).toBeNull();
      expect(labelOf(picked)).toMatch(/, Твій вибір$/);
      expect(within(picked).getByText(labelOf(picked).replace(/, Твій вибір$/, ''))).toHaveStyle({
        textDecorationLine: 'line-through',
      });
    });

    it('keys every option А–Г as in #1674 with its switch off', async () => {
      await open({});
      await play('game-mode-guess-word');

      optionsShown().forEach((option, place) => {
        expect(within(option).getByText(KEYS[place] ?? '')).toBeTruthy();
      });
      await fireEvent.press(screen.getByTestId('game-option-0'));
      expect(screen.queryByTestId(/^game-option-\d+-(stamp|right-mark)$/)).toBeNull();
    });
  });
});
