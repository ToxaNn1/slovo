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
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 3 з 3');
    expect(screen.queryByText(/Життів/)).toBeNull();
    expect(screen.getAllByTestId(/^game-life-\d+$/, { includeHiddenElements: true })).toHaveLength(
      3,
    );

    const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
    const n = /\d+/.exec(prompt)?.[0] ?? '';
    const wrong = screen
      .getAllByRole('button', { name: /^слово\d+,/ })
      .find((one) => !String(one.props['accessibilityLabel']).startsWith(`слово${n},`));
    if (wrong === undefined) throw new Error(`No wrong option for «${prompt}»`);
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
    expect(screen.getAllByTestId(/^game-life-\d+$/, { includeHiddenElements: true })).toHaveLength(
      3,
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
    const livesLabel = () => String(screen.getByTestId('game-lives').props['accessibilityLabel']);

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

    it('heads a Round with «Вгадай слово · 1/N» over the question, no title in the header, and shows the Lives as hexagons only, read as «Життів: n з N», one less after a wrong answer', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: /^Вгадай слово · 1\/\d+$/ })).toBeOnTheScreen();
      });
      expect(screen.queryByTestId('game-title')).toBeNull();
      const [, before = '', total = ''] = /^Життів: (\d+) з (\d+)$/.exec(livesLabel()) ?? [];
      expect(before).toBe(total);
      expect(screen.queryByText(/Життів/)).toBeNull();

      await pickAWrongWord();

      expect(livesLabel()).toBe(`Життів: ${String(Number(total) - 1)} з ${total}`);
    });

    it('heads «Наголос» with «Наголос · 1/N» over «Де наголос?», no title in the header', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-stress'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: /^Наголос · 1\/\d+$/ })).toBeOnTheScreen();
      });
      expect(screen.getByRole('header', { name: 'Де наголос?' })).toBeOnTheScreen();
      expect(screen.queryByTestId('game-title')).toBeNull();
    });

    it('shows no Lives in «На час», which has no Lives', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-timed'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: 'На час' })).toBeOnTheScreen();
      });
      expect(screen.queryByTestId('game-lives')).toBeNull();
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

    it('heads «Наголос» with «Де наголос?» alone, over the Word’s vowels and the hint', async () => {
      await open({ switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-stress'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: 'Де наголос?' })).toBeOnTheScreen();
      });
      expect(screen.getAllByText(/Де наголос\?/, HIDDEN)).toHaveLength(1);
      expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
      expect(screen.getByText('Торкнись голосної, на яку падає наголос')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
      expect(screen.getByRole('button', { name: 'о, третя літера, Правильно' })).toBeTruthy();
    });

    it('asks «Впиши слово» as «Як сказати краще?» over the wrong form alone, with no sentence', async () => {
      await open({ corrections: 15, switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-type-word'));
      await waitFor(() => {
        expect(screen.getByTestId('game-instead')).toHaveTextContent(/^замість «хибне\d+»$/);
      });
      expect(screen.getAllByText('Як сказати краще?', HIDDEN)).toHaveLength(1);
      expect(screen.queryByText(/Речення/, HIDDEN)).toBeNull();
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Як сказати краще\? замість «хибне\d+»$/,
      );
      expect(screen.getByRole('button', { name: 'Перевірити' })).toBeOnTheScreen();
    });

    it('asks «Звідки слово» as «Звідки це слово?» over the Word alone, with no Definition', async () => {
      await open({ origins: 15, switchedOn: BOARD });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-origin'));
      await waitFor(() => {
        expect(screen.getByTestId('game-word')).toHaveTextContent(/^сло́?во\d+$/);
      });
      expect(screen.getAllByText('Звідки це слово?', HIDDEN)).toHaveLength(1);
      expect(screen.queryByText(/ · \d+ \/ \d+$/, HIDDEN)).toBeNull();
      expect(screen.queryByTestId('game-definition')).toBeNull();
      expect(screen.queryByText(/The meaning of/, HIDDEN)).toBeNull();
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Звідки це слово\? сло́?во\d+$/,
      );
    });

    it('keeps the #1674 Round with its switch off: the number in the header and the label, no Lives text', async () => {
      await open({ origins: 15, switchedOn: ['gameRoundMascot'] });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-origin'));
      await waitFor(() => {
        expect(screen.getByRole('header', { name: /^Звідки слово · 1\/\d+$/ })).toBeOnTheScreen();
      });
      expect(screen.getByText(/^Звідки це слово\? · 1 \/ \d+$/, HIDDEN)).toBeOnTheScreen();
      expect(screen.queryByText(/Життів/)).toBeNull();
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
        if (livesLabel().startsWith('Життів: 0 ')) break;
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

    it('keys no option, long ones neither (owner, 15.11), and after a wrong pick stamps ✓ on the right one and crosses the wrong one out', async () => {
      await open({ idioms: 15, switchedOn: ['gameOptionStamp'] });
      await play('game-mode-idiom-meaning');

      optionsShown().forEach((option) => {
        KEYS.forEach((key) => {
          expect(within(option).queryByText(key)).toBeNull();
        });
      });
      const standard = `The sense of idiom${String(theNumberOfThePrompt())}.`;
      const right = optionsShown().findIndex((option) => labelOf(option) === standard);
      const wrong = optionsShown().findIndex((option) => labelOf(option) !== standard);
      const picked = optionsShown()[wrong];
      if (picked === undefined) throw new Error('No wrong option');
      await fireEvent.press(picked);

      expect(screen.getByTestId(`game-option-${String(right)}-stamp`)).toBeTruthy();
      expect(screen.queryByTestId(/^game-option-\d+-(right|wrong)-mark$/)).toBeNull();
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
