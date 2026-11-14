import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { systemSchedule } from '@slovo/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import {
  moveApp,
  warning,
  originOf,
  open,
  renderScreen,
  ALL_CELLS,
  pairsLeft,
  pickTheWordOfThePrompt,
  answerSurvivalRound,
  startGuessWordAtRound11,
  assemble,
  assembleWords,
  theWordsOfThePrompt,
  theStandardFormOfThePrompt,
  theNumberOfThePrompt,
  theOption,
  theWordOfThePrompt,
  pickAnotherWord,
  timerLabel,
  pass,
  resetGameScreen,
} from './test-support';

beforeEach(resetGameScreen);

describe('the Game screen', () => {
  it('starts «Наголос» from its card and plays a whole Game to the result screen', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-stress'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
      });
      expect(
        screen.getByText(/^Де наголос\?( · |$)/, { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Торкнись голосної, на яку падає наголос')).toBeOnTheScreen();
      // «слово» and its number: the first «о» is stressed, the second a vowel to tap too.
      await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
      expect(screen.getByRole('button', { name: 'о, третя літера, Правильно' })).toBeTruthy();
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('asks «Вгадай слово»’s sixth Round by an Example with a gap, which VoiceOver reads, and takes an answer', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
    for (let round = 1; round <= 5; round += 1) {
      await waitFor(() => {
        expect(
          screen.getByText(/^Визначення( · |$)/, { includeHiddenElements: true }),
        ).toBeOnTheScreen();
      });
      await pickTheWordOfThePrompt();
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(
        screen.getByText(/^Яке слово пропущено\?( · |$)/, { includeHiddenElements: true }),
      ).toBeOnTheScreen();
    });
    expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
      /^Яке слово пропущено\? Речення \d+: ось пропуск тут\.$/,
    );
    expect(screen.getByText(/^Речення \d+: ось … тут\.$/)).toBeOnTheScreen();
    await pickTheWordOfThePrompt();

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
  });

  it('asks «Вгадай слово»’s Rounds 11–15 by a Definition for the Word typed, with no blanks, to the result screen', async () => {
    await renderScreen();

    await startGuessWordAtRound11();
    for (let round = 11; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Визначення\. The meaning of test\d+\.$/,
      );
      expect(screen.queryByTestId('game-typed-blanks')).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Відкрити літеру' })).not.toBeOnTheScreen();
      await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), theWordOfThePrompt());
      await fireEvent.press(screen.getByRole('button', { name: 'Перевірити' }));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a Word of «Вгадай слово» typed wrong in Round 11 and shows the right one', async () => {
    await renderScreen();

    await startGuessWordAtRound11();
    await waitFor(() => {
      expect(screen.getByLabelText('Твоя відповідь')).toBeOnTheScreen();
    });
    const word = theWordOfThePrompt();
    await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), 'слово');
    await fireEvent(screen.getByLabelText('Твоя відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(word, { exact: false });
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
  });

  it('starts «Пари» from its card and plays four grids of 4, 4, 4 and 3 pairs to the result screen', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-pairs'));

    const grids: number[] = [];
    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      expect(screen.getByRole('header', { name: 'З’єднай слово і значення' })).toBeOnTheScreen();
      const left = pairsLeft();
      // A grid with none of its pairs gone yet is a new one.
      if (left.length === screen.getAllByTestId(/^pairs-word-\d+$/, ALL_CELLS).length)
        grids.push(left.length);
      const [{ word, definition }] = left as [(typeof left)[number]];
      await fireEvent.press(screen.getByTestId(`pairs-word-${String(word)}`));
      await fireEvent.press(screen.getByTestId(`pairs-definition-${String(definition)}`));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
    expect(grids).toEqual([4, 4, 4, 3]);
  });

  it('takes a Life for a wrong pair in «Пари»', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-pairs'));
    await waitFor(() => {
      expect(screen.getByTestId('pairs')).toBeOnTheScreen();
    });
    const [{ word, definition }] = pairsLeft() as [{ word: number; definition: number }];
    await fireEvent.press(screen.getByTestId(`pairs-word-${String(word)}`));
    await fireEvent.press(screen.getByTestId(`pairs-definition-${String((definition + 1) % 4)}`));

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
  });

  it('starts «За літерами» from its card and plays a whole Game, typing each Word, to the result screen', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-by-letters'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Визначення\. The meaning of test\d+\.$/,
      );
      // A blank for each of «слово{n}»'s letters and digits.
      expect(screen.getAllByLabelText(/ літера, порожня$/)).toHaveLength(
        theWordOfThePrompt().length,
      );
      await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), theWordOfThePrompt());
      await fireEvent.press(screen.getByRole('button', { name: 'Перевірити' }));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('opens the letters of «За літерами» one at a time, at no cost, and takes a Life for a wrong Word', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-by-letters'));
    await waitFor(() => {
      expect(screen.getByTestId('game-typed-blanks')).toBeOnTheScreen();
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Відкрити літеру' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Відкрити літеру' }));

    expect(screen.getByLabelText('с, перша літера')).toBeOnTheScreen();
    expect(screen.getByLabelText('л, друга літера')).toBeOnTheScreen();
    expect(screen.getByLabelText('третя літера, порожня')).toBeOnTheScreen();
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 5 з 5');

    await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), 'слово');
    await fireEvent(screen.getByLabelText('Твоя відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(/слово\d+/);
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
  });

  it('plays «За літерами» as letter tiles in rows of 4 with letterTiles on, no text field', async () => {
    await open({ switchedOn: ['letterTiles'] });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-by-letters'));
    await waitFor(() => {
      expect(screen.getByTestId('chips')).toBeOnTheScreen();
    });
    const word = theWordOfThePrompt();
    const tiles = screen.getAllByTestId(/^chips-\d+$/);
    expect(tiles.length).toBe(Math.max(8, Math.ceil(word.length / 4) * 4));
    for (const row of screen.getAllByTestId(/^chips-row-\d+$/)) {
      expect(within(row).getAllByRole('button')).toHaveLength(4);
    }
    expect(screen.queryByLabelText('Твоя відповідь')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Відкрити літеру' })).toBeNull();

    await assemble(word);

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
  });

  it('keeps the text field of «За літерами» with letterTiles off', async () => {
    await open({ switchedOff: ['letterTiles'] });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-by-letters'));

    await waitFor(() => {
      expect(screen.getByLabelText('Твоя відповідь')).toBeOnTheScreen();
    });
    expect(screen.queryByTestId('chips')).toBeNull();
  });

  it('starts «Анаграми» from its card and plays a whole Game, assembling each Word, to the result screen', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anagram'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Визначення\. The meaning of test\d+\.$/,
      );
      // A chip for each of «слово{n}»'s letters and digits.
      expect(screen.getAllByTestId(/^chips-\d+$/)).toHaveLength(theWordOfThePrompt().length);
      await assemble(theWordOfThePrompt());
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes back the last letter of «Анаграми» with «← Стерти літеру», then takes the Word', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anagram'));
    await waitFor(() => {
      expect(screen.getByTestId('chips')).toBeOnTheScreen();
    });
    const erase = () => screen.getByRole('button', { name: '← Стерти літеру' });
    expect(erase()).toBeDisabled();
    const word = theWordOfThePrompt();
    // A wrong letter for the second, taken back before the line is full.
    await assemble(`${word.charAt(0)}${word.charAt(word.length - 1)}`);
    expect(screen.getByTestId('chips-line')).toHaveTextContent(
      `${word.charAt(0)}${word.charAt(word.length - 1)}`,
    );

    await fireEvent.press(erase());

    expect(screen.getByTestId('chips-line')).toHaveTextContent(word.charAt(0));
    await assemble(word.slice(1));
    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
    expect(erase()).toBeDisabled();
  });

  it('takes a Life for a Word of «Анаграми» assembled wrong and shows the right one', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anagram'));
    await waitFor(() => {
      expect(screen.getByTestId('chips')).toBeOnTheScreen();
    });
    const word = theWordOfThePrompt();
    // «слово{n}» backwards, its number first: never the Word.
    await assemble(Array.from(word).reverse().join(''));

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(word, { exact: false });
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
  });

  it('starts «Впиши слово» from its card and plays a whole Game, typing each standard form, to the result screen', async () => {
    await open({ corrections: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-type-word'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      // Board 07 g3: the card names the wrong form over its sentence; VoiceOver reads both,
      // then names the non-standard form marked in the sentence.
      expect(screen.getByTestId('game-instead')).toHaveTextContent(/^замість «хибне\d+»$/);
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Як сказати краще\? замість «хибне(\d+)»\. Речення \1: тут хибне\1\. Виділено: хибне\1$/,
      );
      // The reader types the whole form: no blanks, no «Відкрити літеру».
      expect(screen.queryByTestId('game-typed-blanks')).toBeNull();
      await fireEvent.changeText(
        screen.getByLabelText('Твоя відповідь'),
        theStandardFormOfThePrompt(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Перевірити' }));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong form in «Впиши слово» and shows the standard form with its explanation', async () => {
    await open({ corrections: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-type-word'));
    await waitFor(() => {
      expect(screen.getByLabelText('Твоя відповідь')).toBeOnTheScreen();
    });
    const standard = theStandardFormOfThePrompt();
    await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), 'хибне');
    await fireEvent(screen.getByLabelText('Твоя відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(new RegExp(standard));
    expect(screen.getByTestId('game-sheet-explanation')).toHaveTextContent(
      `Чому ${standard} краще.`,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
  });

  it('starts «Склади вислів» from its card and plays a whole Game, assembling each expression, to the result screen', async () => {
    await open({ idioms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-build-idiom'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Склади вислів\. The sense of idiom\d+\.$/,
      );
      // A chip for each word, the comma and the dash none.
      expect(
        screen
          .getAllByTestId(/^chips-\d+$/)
          .map((chip): unknown => chip.props['accessibilityLabel']),
      ).toEqual(expect.arrayContaining(theWordsOfThePrompt()));
      expect(screen.getAllByTestId(/^chips-\d+$/)).toHaveLength(3);
      await assembleWords(theWordsOfThePrompt());
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      // The sheet shows the whole expression, its punctuation too.
      expect(screen.getByTestId('game-sheet')).toHaveTextContent(', друге — третє', {
        exact: false,
      });
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes a Life for an expression of «Склади вислів» assembled wrong and shows the right one', async () => {
    await open({ idioms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-build-idiom'));
    await waitFor(() => {
      expect(screen.getByTestId('chips')).toBeOnTheScreen();
    });
    const words = theWordsOfThePrompt();
    warning.mockClear();
    await assembleWords(words.toReversed());

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(`${words[0] ?? ''}, друге — третє`, {
      exact: false,
    });
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
    expect(warning).toHaveBeenCalled();
  });

  it('starts «Англіцизми» from its card and plays a whole Game of anglicisms alone, picking each standard form, to the result screen', async () => {
    await open({ corrections: 15, anglicisms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anglicism'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      // Board 07: «Чим замінити «…»: «…»?», the anglicism still marked in the sentence.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Як сказати краще\? Чим замінити «хибне(\d+)»: «Речення \1: тут хибне\1\.»\? Виділено: хибне\1$/,
      );
      // Anglicisms are numbered after the 15 calques, which never play here.
      const n = theNumberOfThePrompt();
      expect(n).toBeGreaterThanOrEqual(15);
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      await fireEvent.press(theOption(`добре${String(n)}`));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong pick in «Англіцизми» and shows the standard form with its explanation', async () => {
    await open({ anglicisms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anglicism'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });
    const standard = `добре${String(theNumberOfThePrompt())}`;
    const wrong = screen
      .getAllByTestId(/^game-option-\d+$/)
      .find((option) => option.props['accessibilityLabel'] !== standard);
    if (wrong === undefined) throw new Error('No wrong option');
    warning.mockClear();
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(new RegExp(standard));
    expect(screen.getByTestId('game-sheet-explanation')).toHaveTextContent(
      `Чому ${standard} краще.`,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
    expect(warning).toHaveBeenCalled();
  });

  it('starts «Фразеологізми» from its card and plays a whole Game, picking each meaning, to the result screen', async () => {
    await open({ idioms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-idiom-meaning'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 15`,
        );
      });
      // The whole expression, its punctuation too, over four meanings.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Що це означає\? «перше\d+, друге — третє» — це…$/,
      );
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      await fireEvent.press(theOption(`The sense of idiom${String(theNumberOfThePrompt())}\\.`));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong meaning in «Фразеологізми» and shows the right one', async () => {
    await open({ idioms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-idiom-meaning'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });
    const meaning = `The sense of idiom${String(theNumberOfThePrompt())}.`;
    const wrong = screen
      .getAllByTestId(/^game-option-\d+$/)
      .find((option) => option.props['accessibilityLabel'] !== meaning);
    if (wrong === undefined) throw new Error('No wrong option');
    warning.mockClear();
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(meaning, { exact: false });
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
    expect(warning).toHaveBeenCalled();
  });

  it('starts «Виживання» from its card with 3 Lives and no Round limit, mixing Words and Corrections, and ends on the third mistake with the Rounds passed', async () => {
    await open({ corrections: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-survival'));

    const kinds = new Set<string>();
    const mistakes = [3, 8, 12];
    for (let round = 1; round <= 12; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)}`,
        );
      });
      expect(screen.getByTestId('game-progress')).toHaveTextContent(
        `Пройдено: ${String(round - 1)}`,
      );
      expect(screen.queryByTestId('game-progress-bar')).toBeNull();
      const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
      kinds.add(prompt.includes('хибне') ? 'correction' : 'word');
      const right = !mistakes.includes(round);
      await answerSurvivalRound(right);
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent(
        right ? 'Правильно!' : 'Не цього разу',
      );
      const lives = 3 - mistakes.filter((at) => at <= round).length;
      expect(screen.getByTestId('game-lives')).toHaveAccessibleName(`Життів: ${String(lives)} з 3`);
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Життя закінчилися')).toBeOnTheScreen();
    });
    expect(kinds).toEqual(new Set(['word', 'correction']));
    expect(screen.getByTestId('game-result-rounds')).toHaveTextContent(/^раунд\S* ?11$/);
    expect(screen.getByTestId('game-result-rounds').props['accessibilityLabel']).toBe(
      'Пройдено раундів: 11',
    );
    expect(screen.getByTestId('game-result-best')).toHaveTextContent(/11$/);
    // A Game with no Life left offers no widget hint.
    expect(screen.queryByTestId('widget-guide-sheet')).toBeNull();
  });

  describe('«На час»', () => {
    beforeEach(async () => {
      jest.useFakeTimers({ now: new Date('2026-10-26T09:00:00Z') });
      // The faked system time, which the faked timers move and the timer reads too.
      await open({
        clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
        schedule: systemSchedule,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('starts from its card and races 60 seconds with the timer on top, a mistake moving on, to the result screen', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-timed'));

      await waitFor(() => {
        expect(timerLabel()).toBe('лишилось 60 секунд');
      });
      expect(screen.getByTestId('game-timer')).toHaveTextContent('60 с');
      expect(screen.getByTestId('game-progress')).toHaveTextContent('Пройдено: 0');
      expect(screen.queryByTestId('game-lives')).toBeNull();
      expect(screen.queryByTestId('game-life-0', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByRole('header', { name: 'На час' })).toBeOnTheScreen();
      expect(
        screen.getByText(/^Визначення( · |$)/, { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      for (let answered = 0; answered < 3; answered += 1) {
        await pickTheWordOfThePrompt();
        // The next Round comes at once, with no sheet.
        expect(screen.queryByTestId('game-next')).toBeNull();
        expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      }
      warning.mockClear();
      await pickAnotherWord();
      expect(warning).toHaveBeenCalled();
      expect(screen.queryByTestId('game-next')).toBeNull();
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);

      await pass(10_000);

      expect(timerLabel()).toBe('лишилось 50 секунд');
      expect(screen.getByTestId('game-timer')).toHaveTextContent('50 с');

      await pass(50_000);

      await waitFor(() => {
        expect(screen.getByText('Час вийшов!')).toBeOnTheScreen();
      });
      expect(screen.getByTestId('game-result-right').props['accessibilityLabel']).toBe(
        '3 правильні відповіді',
      );
      expect(screen.queryByTestId('game-result-rounds')).toBeNull();
      expect(screen.queryByTestId('game-result-lives')).toBeNull();
      expect(screen.getByTestId('game-result-best')).toHaveTextContent('3', { exact: false });
    });

    it('ends on the «Фініш» poster headed «Час!», «Ще раунд!» for fewer than half right', async () => {
      await open({
        clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
        schedule: systemSchedule,
        switchedOn: ['finishPoster'],
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-timed'));
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилось 60 секунд');
      });
      await pickTheWordOfThePrompt();
      await pickAnotherWord();
      await pickAnotherWord();
      await pass(60_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
      expect(screen.getByText('ЧАС!')).toBeOnTheScreen();
      expect(screen.getByText('ЩЕ РАУНД!')).toBeOnTheScreen();
      expect(screen.getByText('1 з 3 влучання')).toBeOnTheScreen();
      expect(screen.queryByText('Час вийшов!')).toBeNull();
    });

    it('stops the timer while the app is in the background, and runs it on from there on return', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-timed'));
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилось 60 секунд');
      });
      await pass(20_000);

      await moveApp('background');
      await pass(5 * 60_000);

      expect(timerLabel()).toBe('лишилось 40 секунд');
      expect(screen.getByTestId('game-round')).toBeOnTheScreen();

      await moveApp('foreground');
      await pass(39_000);

      expect(timerLabel()).toBe('лишилась 1 секунда');
      expect(screen.getByTestId('game-round')).toBeOnTheScreen();

      await pass(1_000);

      await waitFor(() => {
        expect(screen.getByText('Час вийшов!')).toBeOnTheScreen();
      });
    });
  });

  it('refuses «Звідки слово» with fewer than 8 Words with an origin in the Mix, saying why', async () => {
    await open({ origins: 7 });
    await renderScreen();

    const card = screen.getByTestId('game-mode-origin');
    expect(card.props['accessibilityState']).toEqual({ disabled: true });
    expect(card).toHaveTextContent(/Замало слів із відомим походженням у твоєму Міксі\./);
  });

  it('starts «Звідки слово» from its card and plays a whole Game of 8 Rounds, picking each Word’s language, to the result screen', async () => {
    await open({ origins: 8 });
    await renderScreen();

    expect(screen.getByTestId('game-mode-origin').props['accessibilityState']).toEqual({
      disabled: false,
    });
    await fireEvent.press(screen.getByTestId('game-mode-origin'));

    for (let round = 1; round <= 8; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(round - 1)} з 8`,
        );
      });
      // The Word with its Stress, then its Definition, over four languages.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Звідки це слово\? сло\u0301?во(\d+)\. The meaning of test\1\.$/,
      );
      // Board 07 g4: the Word big on its sunken tile.
      expect(screen.getByTestId('game-word')).toHaveTextContent(/^сло\u0301?во\d+$/);
      const n = Number(
        /test(\d+)/.exec(String(screen.getByTestId('game-definition').props['children']))?.[1],
      );
      expect(n).toBeLessThan(8);
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      await fireEvent.press(theOption(originOf(n)?.name ?? ''));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong language in «Звідки слово» and shows the right one with the Word’s etymology', async () => {
    await open({ origins: 8 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-origin'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });
    const n = Number(
      /test(\d+)/.exec(String(screen.getByTestId('game-definition').props['children']))?.[1],
    );
    const language = originOf(n)?.name ?? '';
    const wrong = screen
      .getAllByTestId(/^game-option-\d+$/)
      .find((option) => option.props['accessibilityLabel'] !== language);
    if (wrong === undefined) throw new Error('No wrong option');
    warning.mockClear();
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(language, { exact: false });
    expect(screen.getByTestId('game-sheet-explanation')).toHaveTextContent(`Від test${String(n)}.`);
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 4 з 5');
    expect(warning).toHaveBeenCalled();
  });
});
