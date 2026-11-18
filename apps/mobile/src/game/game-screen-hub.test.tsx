import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { solveCrossingWord } from './crossing-crossword.test-support';
import {
  composition,
  open,
  sendingShareCard,
  renderScreen,
  shape,
  resetGameScreen,
} from './test-support';

beforeEach(resetGameScreen);

describe('the Game screen', () => {
  it("lists the modes on offer under the board's five groups, in the board's order (ADR 0139)", async () => {
    await renderScreen();

    expect(shape()).toEqual([
      'Ігри',
      'Звук',
      'game-mode-stress',
      'Значення',
      'game-mode-correction',
      'game-mode-pairs',
      'game-mode-idiom-meaning',
      'Букви',
      'game-mode-anagram',
      'Швидкість',
      'game-mode-timed',
      'Нове',
      'game-mode-guess-word',
      'game-mode-by-letters',
      'game-mode-type-word',
      'game-mode-origin',
      'game-mode-anglicism',
      'game-mode-build-idiom',
      'game-mode-survival',
    ]);
  });

  it('leaves out a switched-off mode and its group', async () => {
    await open({ switchedOff: ['corrections'] });
    await renderScreen();

    expect(shape()).toEqual([
      'Ігри',
      'Звук',
      'game-mode-stress',
      'Значення',
      'game-mode-pairs',
      'game-mode-idiom-meaning',
      'Букви',
      'game-mode-anagram',
      'Швидкість',
      'game-mode-timed',
      'Нове',
      'game-mode-guess-word',
      'game-mode-by-letters',
      'game-mode-origin',
      'game-mode-build-idiom',
    ]);
  });

  describe('as board 06 «Хаб ігор»', () => {
    const HUB = ['gameModeToast'];

    it("shows each row's hub line and «Рекорд: N з M», «Рекорд: N» or «Ще жодної гри», read as it shows", async () => {
      await open({ best: { 'guess-word': 12, survival: 23 } });
      await renderScreen();

      const guessWord = within(screen.getByTestId('game-mode-guess-word'));
      expect(guessWord.getByText('Визначення є. Яке це слово?')).toBeTruthy();
      expect(guessWord.getByText('Рекорд: 12 з 15')).toBeTruthy();
      expect(within(screen.getByTestId('game-mode-survival')).getByText('Рекорд: 23')).toBeTruthy();
      expect(screen.getByTestId('game-mode-stress')).toHaveAccessibleName(
        'Наголос. Торкнись наголошеної голосної. Ще жодної гри',
      );
      expect(screen.queryByText(/★/)).toBeNull();
    });

    it("shows the owner's glyphs and hub lines where the board's ones did not fit", async () => {
      await open({ corrections: 15, idioms: 15 });
      await renderScreen();

      const rows: readonly (readonly [string, string, string])[] = [
        ['survival', '⚑⚑⚑', 'Три життя. Як далеко зайдеш?'],
        ['timed', '20 с', 'Двадцять секунд. Скільки слів встигнеш?'],
        ['pairs', '=', 'З’єднай чотири слова з їхніми значеннями.'],
        ['type-word', 'Аб|', 'Помилка, яку часто чуєш. Впиши, як краще.'],
        ['build-idiom', '«…»', 'Читаєш значення — складаєш вислів.'],
      ];
      for (const [modeId, glyph, line] of rows) {
        const row = within(screen.getByTestId(`game-mode-${modeId}`));
        expect(row.getByText(glyph)).toBeTruthy();
        expect(row.getByText(line)).toBeTruthy();
      }
      expect(screen.queryByText(/[Хх]вилин/)).toBeNull();
    });

    it('shows the toast on a tap of a mode that cannot be played, and starts nothing', async () => {
      await open({ switchedOn: HUB });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-correction'));

      expect(
        screen.getByText('«Обери правильне» ще розминається. Влучай поки в «Наголос»!'),
      ).toBeTruthy();
      expect(screen.getByTestId('game-modes')).toBeTruthy();
      expect(composition.game.state.current).toBeUndefined();
    });

    it('shows the toast on a tap of «Англіцизми» with 12 anglicisms of the 15 it needs, and starts nothing', async () => {
      await open({ switchedOn: HUB, corrections: 15, anglicisms: 12 });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-anglicism'));

      expect(
        screen.getByText('«Англіцизми» ще розминається. Влучай поки в «Наголос»!'),
      ).toBeTruthy();
      expect(screen.getByTestId('game-modes')).toBeTruthy();
      expect(composition.game.state.current).toBeUndefined();
    });

    it('shows the toast when a mode on offer turns out short of Entries as it starts, and starts nothing', async () => {
      await open({ switchedOn: HUB, corrections: 15, anglicisms: 15 });
      // The Entries went short since the offer was planned: the start makes no Game.
      jest.spyOn(composition.game, 'start').mockResolvedValue(undefined);
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-anglicism'));

      expect(
        await screen.findByText('«Англіцизми» ще розминається. Влучай поки в «Наголос»!'),
      ).toBeTruthy();
      expect(composition.game.state.current).toBeUndefined();
    });

    it('keeps the look of a mode that cannot be played, with no reason in place of its line', async () => {
      await open({ switchedOn: HUB });
      await renderScreen();

      expect(screen.getByTestId('game-mode-correction')).not.toBeDisabled();
      expect(screen.queryByText(/Цьому режиму бракує виправлень/)).toBeNull();
    });
  });

  /** Today's crossing Daily Crossword, as the composition opens it. */
  async function crossingCrossword() {
    const opening = await composition.openDailyCrossword();
    if (opening.kind !== 'crossing') throw new Error(`Expected the puzzle, got ${opening.kind}`);
    return opening.crossword;
  }

  /** Solves every Word of today's crossing Daily Crossword, after these seconds on screen. */
  async function solveCrossing(seconds = 0, { hint = false } = {}) {
    const crossword = await crossingCrossword();
    if (seconds > 0) await crossword.play({ type: 'tick', seconds });
    if (hint) await crossword.play({ type: 'hint' });
    for (const index of crossword.puzzle.words.keys()) await solveCrossingWord(crossword, index);
    await crossword.keep();
    return crossword;
  }

  it('puts the Daily Crossword’s card «Кросворд дня · {date}» above the groups, with its size, its count of Words and «Розгадати»', async () => {
    await open({ crossing: true });
    const { words } = (await crossingCrossword()).puzzle;
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(within(card).getByText('Кросворд дня · 26 жовтня')).toBeOnTheScreen();
    expect(within(card).getByText(`5×5 · ${String(words.length)} слів`)).toBeOnTheScreen();
    expect(within(card).getByText('Розгадати')).toBeOnTheScreen();
    expect(card.props['accessibilityLabel']).toBe(
      `Кросворд дня · 26 жовтня. 5×5 · ${String(words.length)} слів. Розгадати`,
    );
    const cards = within(screen.getByTestId('game-modes'))
      .getAllByTestId(/^(daily-crossword|game-mode-.+)$/)
      .map((node): unknown => node.props['testID']);
    expect(cards[0]).toBe('daily-crossword');
    expect(cards.slice(1)).toContain('game-mode-guess-word');
  });

  it('offers «Продовжити» with a bar of the Words solved once a Word of today’s is', async () => {
    await open({ crossing: true });
    const crossword = await crossingCrossword();
    await solveCrossingWord(crossword, 0);
    await crossword.keep();
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(card.props['accessibilityLabel']).toBe('Кросворд дня · 26 жовтня. Продовжити');
    expect(card.props['accessibilityValue']).toEqual({
      min: 0,
      max: crossword.puzzle.words.length,
      now: 1,
    });
    expect(within(card).queryByText(/слів$/)).toBeNull();
  });

  it('marks the card «✓ Розгадано» «за {time} · без підказок» with its grid of cells once today’s is solved', async () => {
    await open({ crossing: true, switchedOn: ['crosswordSolveTime'] });
    const crossword = await solveCrossing(252);
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(card.props['accessibilityLabel']).toBe(
      'Кросворд дня · 26 жовтня. ✓ Розгадано. за 4:12 · без підказок',
    );
    expect(within(card).getByText('за 4:12 · без підказок')).toBeOnTheScreen();
    expect(within(card).queryByText('Продовжити')).toBeNull();
    const { blocks } = crossword.puzzle;
    expect(within(card).getAllByTestId(/^daily-crossword-block-/)).toHaveLength(blocks.length);
    expect(within(card).getAllByTestId(/^daily-crossword-cell-/)).toHaveLength(25 - blocks.length);
  });

  it('leaves «без підказок» off the solved card once «Підказка» was used', async () => {
    await open({ crossing: true, switchedOn: ['crosswordSolveTime', 'crosswordHint'] });
    await solveCrossing(65, { hint: true });
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(within(card).getByText('за 1:05')).toBeOnTheScreen();
    expect(within(card).queryByText(/без підказок/)).toBeNull();
  });

  it('shows no time line on the solved card when its record has no time', async () => {
    await open({ crossing: true });
    await solveCrossing();
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(card.props['accessibilityLabel']).toBe('Кросворд дня · 26 жовтня. ✓ Розгадано');
    expect(within(card).queryByText(/^за /)).toBeNull();
  });

  it('leaves out the Daily Crossword’s card on a day no pattern fills', async () => {
    await open();
    await renderScreen();

    await screen.findByTestId('game-modes');
    expect(screen.queryByTestId('daily-crossword')).toBeNull();
  });

  it('shows the XP earned in all, over every day, beside the title', async () => {
    await open({
      xp: [
        { date: '2026-10-20', amount: 30 },
        { date: '2026-10-26', amount: 15 },
      ],
    });
    await renderScreen();

    const pill = screen.getByTestId('games-xp');
    expect(pill).toHaveTextContent('45 XP');
    expect(pill.props['accessibilityLabel']).toBe('Усього XP: 45');
  });

  it('shows no XP while the reader hides the counters', async () => {
    await renderScreen({ settings: { noCounters: true } });

    expect(screen.queryByTestId('games-xp')).toBeNull();
  });

  it('shows no XP with the XP log switched off', async () => {
    await open({ switchedOff: ['xpLog'] });
    await renderScreen();

    expect(screen.queryByTestId('games-xp')).toBeNull();
  });

  it('leaves out the Daily Crossword’s card with its Feature Switch off', async () => {
    await open({ switchedOff: ['dailyCrossword'] });
    await renderScreen();

    expect(screen.queryByTestId('daily-crossword')).toBeNull();
    expect(screen.getByTestId('game-mode-guess-word')).toBeOnTheScreen();
  });

  it('offers no progress Share Card on the hub, even for a Level reached today', async () => {
    await open({ xp: [{ date: '2026-10-26', amount: 60 }] });
    await renderScreen({ shareCard: sendingShareCard });
    await screen.findByTestId('game-mode-guess-word');

    expect(screen.queryAllByTestId(/^progress-share-/)).toEqual([]);
    expect(screen.queryByRole('button', { name: /Новий рівень/ })).toBeNull();
  });
});
