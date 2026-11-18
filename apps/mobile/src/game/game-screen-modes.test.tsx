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

/** The number of the Word a Round of «Звідки слово» shows: «слово{n}» is the Entry of «test{n}». */
const theNumberOfTheWord = () =>
  Number(/(\d+)$/.exec(String(screen.getByTestId('game-prompt').props['accessibilityLabel']))?.[1]);

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
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
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

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a Word of «Вгадай слово» typed wrong in Round 11 and shows its Definition on the answer card', async () => {
    await renderScreen();

    await startGuessWordAtRound11();
    await waitFor(() => {
      expect(screen.getByLabelText('Твоя відповідь')).toBeOnTheScreen();
    });
    const word = theWordOfThePrompt();
    await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), 'слово');
    await fireEvent(screen.getByLabelText('Твоя відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
      `The meaning of test${word.slice('слово'.length)}.`,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
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

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
  });

  it('pauses after a pair and takes a found pair out of the grid on «Далі»', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-pairs'));
    await waitFor(() => {
      expect(screen.getByTestId('pairs')).toBeOnTheScreen();
    });
    const [{ word, definition }] = pairsLeft() as [{ word: number; definition: number }];
    await fireEvent.press(screen.getByTestId(`pairs-word-${String(word)}`));
    await fireEvent.press(screen.getByTestId(`pairs-definition-${String(definition)}`));

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
    await fireEvent.press(screen.getByTestId('game-next'));
    await waitFor(() => {
      expect(screen.queryByTestId(`pairs-word-${String(word)}`)).toBeNull();
    });
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
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
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 3 з 3');

    await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), 'слово');
    await fireEvent(screen.getByLabelText('Твоя відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
      /^The meaning of test\d+\.$/,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
  });

  it('plays «За літерами» in a text field, no chips', async () => {
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
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
    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
    expect(erase()).toBeDisabled();
  });

  it('takes a Life for a Word of «Анаграми» assembled wrong and shows its Definition on the answer card', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anagram'));
    await waitFor(() => {
      expect(screen.getByTestId('chips')).toBeOnTheScreen();
    });
    const word = theWordOfThePrompt();
    // «слово{n}» backwards, its number first: never the Word.
    await assemble(Array.from(word).reverse().join(''));

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
      `The meaning of test${word.slice('слово'.length)}.`,
    );
    // The slots show the right Word in place of the one assembled.
    expect(screen.getByTestId('chips-line')).toHaveTextContent(word);
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
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
      // On the ground the question names the wrong form alone, with no sentence.
      expect(screen.getByTestId('game-instead')).toHaveTextContent(/^замість «хибне\d+»$/);
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Як сказати краще\? замість «хибне\d+»$/,
      );
      // The reader types the whole form: no blanks, no «Відкрити літеру».
      expect(screen.queryByTestId('game-typed-blanks')).toBeNull();
      await fireEvent.changeText(
        screen.getByLabelText('Твоя відповідь'),
        theStandardFormOfThePrompt(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Перевірити' }));
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong form in «Впиши слово» and shows the explanation on the answer card', async () => {
    await open({ corrections: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-type-word'));
    await waitFor(() => {
      expect(screen.getByLabelText('Твоя відповідь')).toBeOnTheScreen();
    });
    const standard = theStandardFormOfThePrompt();
    await fireEvent.changeText(screen.getByLabelText('Твоя відповідь'), 'хибне');
    await fireEvent(screen.getByLabelText('Твоя відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
      `Чому ${standard} краще.`,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
        /^The sense of idiom\d+\.$/,
      );
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
    });
  });

  it('takes a Life for an expression of «Склади вислів» assembled wrong and shows its Definition on the answer card', async () => {
    await open({ idioms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-build-idiom'));
    await waitFor(() => {
      expect(screen.getByTestId('chips')).toBeOnTheScreen();
    });
    const words = theWordsOfThePrompt();
    warning.mockClear();
    await assembleWords(words.toReversed());

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
      /^The sense of idiom\d+\.$/,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
    expect(warning).toHaveBeenCalled();
  });

  it('heads «Англіцизми» on the ground with «АНГЛІЦИЗМИ» over the sentence alone, each option marking its replacement', async () => {
    await open({ anglicisms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anglicism'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });

    expect(screen.getAllByText('Англіцизми', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByTestId('game-kicker')).toHaveTextContent(/^Англіцизми · 1\/\d+$/);
    expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
      /^Англіцизми\. Речення (\d+): тут хибне\1\. Виділено: хибне\1$/,
    );
    for (const option of screen.getAllByTestId(/^game-option-\d+$/)) {
      const replacement = /тут (добре\d+)\.$/.exec(String(option.props['accessibilityLabel']))?.[1];
      expect(within(option).getByText(replacement ?? '-')).toBeOnTheScreen();
    }
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
      // On the ground the sentence alone, the anglicism marked in it.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Англіцизми\. Речення (\d+): тут хибне\1\. Виділено: хибне\1$/,
      );
      // Anglicisms are numbered after the 15 calques, which never play here.
      const n = theNumberOfThePrompt();
      expect(n).toBeGreaterThanOrEqual(15);
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      // Each option is the sentence with its replacement in the anglicism's place.
      for (const option of screen.getAllByTestId(/^game-option-\d+$/)) {
        expect(option.props['accessibilityLabel']).toMatch(/^Речення \d+: тут добре\d+\.$/);
      }
      await fireEvent.press(theOption(`Речення ${String(n)}: тут добре${String(n)}\\.`));
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong pick in «Англіцизми» and shows the explanation on the answer card', async () => {
    await open({ anglicisms: 15 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-anglicism'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });
    const n = String(theNumberOfThePrompt());
    const standard = `добре${n}`;
    const wrong = screen
      .getAllByTestId(/^game-option-\d+$/)
      .find((option) => option.props['accessibilityLabel'] !== `Речення ${n}: тут ${standard}.`);
    if (wrong === undefined) throw new Error('No wrong option');
    warning.mockClear();
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(
      `Чому ${standard} краще.`,
    );
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong meaning in «Фразеологізми» and shows its Definition on the answer card', async () => {
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

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(meaning);
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
    expect(warning).toHaveBeenCalled();
  });

  it('starts «Виживання» from its card with 3 Lives and no Round limit, mixing Words and Corrections, and ends on the third mistake with its right answers as the Best result', async () => {
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
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
        right ? 'Влучно!' : 'Майже. Наступне вийде.',
      );
      const lives = 3 - mistakes.filter((at) => at <= round).length;
      expect(screen.getByTestId('game-lives')).toHaveAccessibleName(`Життів: ${String(lives)} з 3`);
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-lives-over')).toBeOnTheScreen();
    });
    expect(kinds).toEqual(new Set(['word', 'correction']));
    expect(screen.getByTestId('game-end-best')).toHaveTextContent(/9$/);
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

    it('starts from its card and races 20 seconds with the timer on top, a mistake moving on, to «Фініш»', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-timed'));

      await waitFor(() => {
        expect(timerLabel()).toBe('лишилося 20 секунд');
      });
      expect(screen.getByTestId('game-timer')).toHaveTextContent('20 с');
      expect(screen.getByTestId('game-progress')).toHaveTextContent('Пройдено: 0');
      expect(screen.queryByTestId('game-lives')).toBeNull();
      expect(screen.queryByTestId('game-life-0', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByRole('header', { name: 'На час' })).toBeOnTheScreen();
      expect(
        screen.getByText(/^Визначення( · |$)/, { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      for (let answered = 0; answered < 3; answered += 1) {
        await pickTheWordOfThePrompt();
        // The banner shows with no sheet, and the next Round comes 550 ms on, the time running under it.
        expect(screen.getByTestId('game-answer-banner')).toBeOnTheScreen();
        expect(screen.queryByTestId('game-next')).toBeNull();
        await pass(550);
        expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      }
      warning.mockClear();
      await pickAnotherWord();
      // The wrong answer's banner shows no «Далі» in «На час» and moves on after 3 s (ADR 0179).
      expect(warning).toHaveBeenCalled();
      expect(screen.queryByTestId('game-next')).toBeNull();
      await pass(3_000);
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);

      await pass(5_000 - 3 * 550 - 3_000);

      expect(timerLabel()).toBe('лишилося 15 секунд');
      expect(screen.getByTestId('game-timer')).toHaveTextContent('15 с');

      await pass(15_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
      expect(screen.getByText('3 з 4 влучань')).toBeOnTheScreen();
      expect(screen.getByTestId('game-end-best')).toHaveTextContent('3', { exact: false });
    });

    it('ends on the «Фініш» poster, «Ще раунд!» for fewer than half right', async () => {
      await open({
        clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
        schedule: systemSchedule,
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-timed'));
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилося 20 секунд');
      });
      await pickTheWordOfThePrompt();
      await pass(550);
      await pickAnotherWord();
      await pass(3_000);
      await pickAnotherWord();
      await pass(20_000 - 550 - 3_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
      expect(screen.getByText('ФІНІШ')).toBeOnTheScreen();
      expect(screen.getByText('ЩЕ РАУНД!')).toBeOnTheScreen();
      expect(screen.getByText('1 з 3 влучань')).toBeOnTheScreen();
    });

    it('stops the timer while the app is in the background, and runs it on from there on return', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-timed'));
      await waitFor(() => {
        expect(timerLabel()).toBe('лишилося 20 секунд');
      });
      await pass(5_000);

      await moveApp('background');
      await pass(5 * 60_000);

      expect(timerLabel()).toBe('лишилося 15 секунд');
      expect(screen.getByTestId('game-round')).toBeOnTheScreen();

      await moveApp('foreground');
      await pass(14_000);

      expect(timerLabel()).toBe('лишилася 1 секунда');
      expect(screen.getByTestId('game-round')).toBeOnTheScreen();

      await pass(1_000);

      await waitFor(() => {
        expect(screen.getByTestId('game-end-time-up')).toBeOnTheScreen();
      });
    });
  });

  it('refuses «Звідки слово» with fewer than 8 Words with an origin in the Mix, saying why', async () => {
    await open({ origins: 7 });
    await renderScreen();

    const card = screen.getByTestId('game-mode-origin');
    expect(card.props['accessibilityState']).toEqual({ disabled: true });
    expect(card).toHaveTextContent(/Цьому режиму бракує слів із відомим походженням\./);
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
      // The Word with its Stress alone, with no Definition, over four languages.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Звідки це слово\? сло\u0301?во\d+$/,
      );
      expect(screen.queryByTestId('game-definition')).toBeNull();
      const n = theNumberOfTheWord();
      expect(n).toBeLessThan(8);
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
      await fireEvent.press(theOption(originOf(n)?.name ?? ''));
      expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent('Влучно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('game-end-finished')).toBeOnTheScreen();
    });
  });

  it('takes a Life for a wrong language in «Звідки слово» and shows the Word’s etymology on the answer card', async () => {
    await open({ origins: 8 });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-origin'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^game-option-\d+$/)).toHaveLength(4);
    });
    const n = theNumberOfTheWord();
    const language = originOf(n)?.name ?? '';
    const wrong = screen
      .getAllByTestId(/^game-option-\d+$/)
      .find((option) => option.props['accessibilityLabel'] !== language);
    if (wrong === undefined) throw new Error('No wrong option');
    warning.mockClear();
    await fireEvent.press(wrong);

    expect(screen.getByTestId('game-answer-card-title')).toHaveTextContent(
      'Майже. Наступне вийде.',
    );
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent(`Від test${String(n)}.`);
    expect(screen.getByTestId('game-lives')).toHaveAccessibleName('Життів: 2 з 3');
    expect(warning).toHaveBeenCalled();
  });
});
