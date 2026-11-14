import { beforeEach, describe, expect, it } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { solveCrossingWord } from './crossing-crossword.test-support';
import {
  composition,
  open,
  sendingShareCard,
  renderScreen,
  shape,
  resetGameScreen,
} from './game-screen.test-support';

beforeEach(resetGameScreen);

describe('the Game screen', () => {
  it('lists the modes on offer under their groups, in order', async () => {
    await renderScreen();

    expect(shape()).toEqual([
      'Ігри',
      'Слова',
      'game-mode-guess-word',
      'game-mode-stress',
      'game-mode-pairs',
      'game-mode-anagram',
      'game-mode-by-letters',
      'game-mode-type-word',
      'game-mode-origin',
      'Виправлення',
      'game-mode-correction',
      'game-mode-anglicism',
      'Вислови',
      'game-mode-idiom-meaning',
      'game-mode-build-idiom',
      'Виклик',
      'game-mode-survival',
      'game-mode-timed',
    ]);
  });

  it('shows every mode row with its one-liner and «★ n» for its Best result or «—» before', async () => {
    await open({
      best: { 'guess-word': 12, correction: 7, survival: 23 },
      corrections: 15,
      anglicisms: 15,
      idioms: 15,
      origins: 15,
    });
    await renderScreen();

    const rows: readonly (readonly [string, string, string])[] = [
      ['guess-word', 'Обери слово за визначенням', '★ 12'],
      ['stress', 'Влуч у правильний склад', '—'],
      ['pairs', 'З’єднай слово і його значення', '—'],
      ['anagram', 'Збери слово з перемішаних літер', '—'],
      ['by-letters', 'Склади слово з плиток за визначенням', '—'],
      ['type-word', 'Виправ помилку — впиши як треба', '—'],
      ['origin', 'Вгадай, з якої мови прийшло слово', '—'],
      ['correction', 'Обери, як кажуть українською', '★ 7'],
      ['anglicism', 'Заміни англіцизм українським словом', '—'],
      ['idiom-meaning', 'Вгадай, що означає вислів', '—'],
      ['build-idiom', 'Склади вислів слово за словом', '—'],
      ['survival', 'Грай, доки не схибиш. Далеко зайдеш?', '★ 23'],
      ['timed', 'Хвилина, щоб угадати якнайбільше', '—'],
    ];
    for (const [modeId, line, mark] of rows) {
      const row = within(screen.getByTestId(`game-mode-${modeId}`));
      expect(row.getByText(line)).toBeTruthy();
      expect(row.getByText(mark)).toBeTruthy();
    }
    expect(screen.queryByText(/Найкраще/)).toBeNull();
  });

  it('reads a row’s Best result in words, out of its Round limit, and no dash', async () => {
    await open({ best: { 'guess-word': 12, survival: 23 } });
    await renderScreen();

    expect(screen.getByTestId('game-mode-guess-word')).toHaveAccessibleName(
      'Вгадай слово. Обери слово за визначенням. Найкраще: 12 з 15',
    );
    // «Виживання» has no Round limit, so its Best result stands alone.
    expect(screen.getByTestId('game-mode-survival')).toHaveAccessibleName(
      'Виживання. Грай, доки не схибиш. Далеко зайдеш? Найкраще: 23',
    );
    expect(screen.getByTestId('game-mode-stress')).toHaveAccessibleName(
      'Наголос. Влуч у правильний склад',
    );
  });

  it('leaves out a switched-off mode and its group', async () => {
    await open({ switchedOff: ['corrections'] });
    await renderScreen();

    expect(shape()).toEqual([
      'Ігри',
      'Слова',
      'game-mode-guess-word',
      'game-mode-stress',
      'game-mode-pairs',
      'game-mode-anagram',
      'game-mode-by-letters',
      'game-mode-origin',
      'Вислови',
      'game-mode-idiom-meaning',
      'game-mode-build-idiom',
      'Виклик',
      'game-mode-timed',
    ]);
    expect(screen.queryByText('Виправлення')).toBeNull();
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

  it('puts the Daily Crossword’s card «Кросворд дня · {date}» above the groups, with its size, its count of Words and «Почати»', async () => {
    await open({ crossing: true });
    const { words } = (await crossingCrossword()).puzzle;
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(within(card).getByText('Кросворд дня · 26 жовтня')).toBeOnTheScreen();
    expect(within(card).getByText(`5×5 · ${String(words.length)} слів`)).toBeOnTheScreen();
    expect(within(card).getByText('Почати')).toBeOnTheScreen();
    expect(card.props['accessibilityLabel']).toBe(
      `Кросворд дня · 26 жовтня. 5×5 · ${String(words.length)} слів. Почати`,
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

  it('marks the card «✓ Розв’язано» «за {time} · без підказок» with its grid of cells once today’s is solved', async () => {
    await open({ crossing: true, switchedOn: ['crosswordSolveTime'] });
    const crossword = await solveCrossing(252);
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(card.props['accessibilityLabel']).toBe(
      'Кросворд дня · 26 жовтня. ✓ Розв’язано. за 4:12 · без підказок',
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
    expect(card.props['accessibilityLabel']).toBe('Кросворд дня · 26 жовтня. ✓ Розв’язано');
    expect(within(card).queryByText(/^за /)).toBeNull();
  });

  it('leaves out the Daily Crossword’s card on a day no pattern fills', async () => {
    await open({ switchedOn: ['crossingCrossword'] });
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
