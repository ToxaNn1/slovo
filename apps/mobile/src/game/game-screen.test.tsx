import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider } from '@slovo/ui';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import GameScreen from '../app/game';
import { edition, editionStrings } from '../edition/edition';

/** The Ukrainian Edition with the given Feature Switches turned off. */
function editionWithout(switchedOff: readonly string[]): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      ...Object.fromEntries(switchedOff.map((name) => [name, false])),
    },
  });
}

/** The Edition the screen reads, as it ships unless a test turns a switch off. */
let mockEdition: Edition;

/** The composition the screen reads, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({
  useComposition: () => mockComposition,
  compositionOpening: { opened: () => Promise.resolve(mockComposition) },
}));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
jest.mock('../settings/settings', () => ({
  useSettings: () => ({ current: { hideStreak: false, selfCheck: false } }),
}));
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ navigate: () => undefined, push: () => undefined }),
}));

/**
 * A Word of one Category, with nothing but what the Game reads: «слово» and
 * its number, stressed on its first vowel, in an Example of its own.
 */
const word = (index: number): Word => ({
  kind: 'word',
  id: `w_test${String(index)}`,
  lemma: `слово${String(index)}`,
  stress: [2],
  partOfSpeech: 'noun',
  primaryDefinition: `The meaning of test${String(index)}.`,
  extraDefinitions: [],
  examples: [{ text: `Речення ${String(index)}: ось слово${String(index)} тут.` }],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
});

/**
 * A Correction with nothing but what the Game reads: the non-standard
 * «хибне» and its number in a sentence of its own, the standard «добре» and
 * its number.
 */
const correction = (index: number): Correction => ({
  kind: 'correction',
  id: `c_test${String(index)}`,
  nonStandardForm: `хибне${String(index)}`,
  correctionType: 'calque',
  standardEquivalents: [`добре${String(index)}`],
  explanation: `Чому добре${String(index)} краще.`,
  examplePair: {
    nonStandard: `Речення ${String(index)}: тут хибне${String(index)}.`,
    standard: `Речення ${String(index)}: тут добре${String(index)}.`,
  },
  categoryId: 'everyday',
  sources: [{ title: 'Test source' }],
  literaryUses: [],
  retired: false,
});

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Opens the composition over 15 Words and the given number of Corrections,
 * with the given Best results by mode id kept from before.
 */
async function open({
  best = {},
  corrections = 0,
  switchedOff = [],
}: {
  best?: Record<string, number>;
  corrections?: number;
  switchedOff?: readonly string[];
} = {}) {
  mockEdition = editionWithout(switchedOff);
  const records = new Map(
    Object.entries(best).map(([modeId, result]) => [`game.best.${modeId}`, JSON.stringify(result)]),
  );
  mockComposition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: Array.from({ length: 15 }, (_, i) => word(i)),
      corrections: Array.from({ length: corrections }, (_, i) => correction(i)),
    }),
    edition: mockEdition,
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <HapticsProvider haptics={haptics}>
          <GameScreen />
        </HapticsProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  // The Game plans its offers once the composition is open.
  await waitFor(() => {
    expect(screen.getByTestId('game-mode-guess-word').props['accessibilityState']).toEqual({
      disabled: false,
    });
  });
}

/** The titles over the cards and the mode cards, top to bottom, as VoiceOver meets them. */
function shape(): string[] {
  return within(screen.getByTestId('game-modes'))
    .getAllByRole(/^(header|button)$/)
    .map((node): unknown => node.props['testID'] ?? node.props['children'])
    .map(String);
}

/** A pairs grid's cells with the ones gone, which VoiceOver skips, so that a place counts them too. */
const ALL_CELLS = { includeHiddenElements: true };

/**
 * The pairs of the grid on the screen still to match: the place of each Word
 * left among the Words with the place of its own Definition, «слово{n}»'s
 * being «The meaning of test{n}.».
 */
function pairsLeft(): { word: number; definition: number }[] {
  const definitions = screen
    .getAllByTestId(/^pairs-definition-/, ALL_CELLS)
    .map((cell): unknown => cell.props['accessibilityLabel']);
  return screen.getAllByTestId(/^pairs-word-/, ALL_CELLS).flatMap((cell, word) => {
    if (cell.props['accessibilityElementsHidden'] === true) return [];
    const n = /\d+/.exec(String(cell.props['accessibilityLabel']))?.[0] ?? '';
    return [{ word, definition: definitions.indexOf(`The meaning of test${n}.`) }];
  });
}

/** Picks the option of the Word whose number is the prompt's, right in a Round of «Вгадай слово». */
async function pickTheWordOfThePrompt() {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  const n = /\d+/.exec(prompt)?.[0] ?? '';
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^слово${n},`) }));
}

/** Starts «Вгадай слово» from its card and picks the right Word in each of its first ten Rounds. */
async function startGuessWordAtRound11() {
  await fireEvent.press(screen.getByTestId('game-mode-guess-word'));
  for (let round = 1; round <= 10; round += 1) {
    await waitFor(() => {
      expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
        `Пройдено раундів: ${String(round - 1)} з 15`,
      );
    });
    await pickTheWordOfThePrompt();
    await fireEvent.press(screen.getByTestId('game-next'));
  }
}

/** Taps the shuffled letter chips of a Round of «Анаграми» in the order of the text. */
async function assemble(text: string) {
  for (const letter of text) {
    const chip = screen
      .getAllByTestId(/^chips-\d+$/)
      .find((one) => one.props['accessibilityLabel'] === letter);
    if (chip === undefined) throw new Error(`No chip «${letter}» left`);
    await fireEvent.press(chip);
  }
}

/** The standard form a Round of «Впиши слово» asks for: «добре{n}» for the prompt's «хибне{n}». */
function theStandardFormOfThePrompt(): string {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return `добре${/хибне(\d+)/.exec(prompt)?.[1] ?? ''}`;
}

/** The Word a Round of «За буквами» or «Анаграми» asks about: «слово{n}», its Definition «The meaning of test{n}.». */
function theWordOfThePrompt(): string {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return `слово${/\d+/.exec(prompt)?.[0] ?? ''}`;
}

beforeEach(async () => {
  await open();
});

describe('the Game screen', () => {
  it('lists the modes on offer under their groups, in order', async () => {
    await renderScreen();

    expect(shape()).toEqual([
      'Гра',
      'Слова',
      'game-mode-guess-word',
      'game-mode-stress',
      'game-mode-pairs',
      'game-mode-anagram',
      'game-mode-by-letters',
      'game-mode-type-word',
      'Виправлення',
      'game-mode-correction',
    ]);
  });

  it('shows each mode’s own Best result on its card, out of its Round limit', async () => {
    await open({ best: { 'guess-word': 12, correction: 7 } });
    await renderScreen();

    expect(
      within(screen.getByTestId('game-mode-guess-word')).getByText('Найкраще: 12 з 15'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('game-mode-correction')).getByText('Найкраще: 7 з 15'),
    ).toBeTruthy();
    // The line under the title keeps «Вгадай слово»'s Best result.
    expect(screen.getByTestId('game-rules')).toHaveTextContent(/Найкраще — 12 \/ 15\./);
  });

  it('shows no Best result on a mode without a finished Game', async () => {
    await open({ best: { 'guess-word': 12 } });
    await renderScreen();

    expect(within(screen.getByTestId('game-mode-correction')).queryByText(/Найкраще/)).toBeNull();
  });

  it('leaves out a switched-off mode and its group', async () => {
    await open({ switchedOff: ['corrections'] });
    await renderScreen();

    expect(shape()).toEqual([
      'Гра',
      'Слова',
      'game-mode-guess-word',
      'game-mode-stress',
      'game-mode-pairs',
      'game-mode-anagram',
      'game-mode-by-letters',
    ]);
    expect(screen.queryByText('Виправлення')).toBeNull();
  });

  it('starts «Наголос» from its card and plays a whole Game to the result screen', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('game-mode-stress'));

    for (let round = 1; round <= 15; round += 1) {
      await waitFor(() => {
        expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
      });
      expect(screen.getByText('Де наголос?')).toBeOnTheScreen();
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
        expect(screen.getByText('Визначення')).toBeOnTheScreen();
      });
      await pickTheWordOfThePrompt();
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Яке слово пропущено?')).toBeOnTheScreen();
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
      await fireEvent.changeText(screen.getByLabelText('Ваша відповідь'), theWordOfThePrompt());
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
      expect(screen.getByLabelText('Ваша відповідь')).toBeOnTheScreen();
    });
    const word = theWordOfThePrompt();
    await fireEvent.changeText(screen.getByLabelText('Ваша відповідь'), 'слово');
    await fireEvent(screen.getByLabelText('Ваша відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(word, { exact: false });
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
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
      expect(screen.getByText('Знайдіть пари')).toBeOnTheScreen();
      const left = pairsLeft();
      // A grid with none of its pairs gone yet is a new one.
      if (left.length === screen.getAllByTestId(/^pairs-word-/, ALL_CELLS).length)
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
  });

  it('starts «За буквами» from its card and plays a whole Game, typing each Word, to the result screen', async () => {
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
      await fireEvent.changeText(screen.getByLabelText('Ваша відповідь'), theWordOfThePrompt());
      await fireEvent.press(screen.getByRole('button', { name: 'Перевірити' }));
      expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Правильно!');
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Перемога!')).toBeOnTheScreen();
    });
  });

  it('opens the letters of «За буквами» one at a time, at no cost, and takes a Life for a wrong Word', async () => {
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 5 з 5');

    await fireEvent.changeText(screen.getByLabelText('Ваша відповідь'), 'слово');
    await fireEvent(screen.getByLabelText('Ваша відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(/слово\d+/);
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
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
      // VoiceOver reads the sentence, then names the non-standard form marked in it.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Як сказати краще\? Речення (\d+): тут хибне\1\. Виділено: хибне\1$/,
      );
      // The reader types the whole form: no blanks, no «Відкрити літеру».
      expect(screen.queryByTestId('game-typed-blanks')).toBeNull();
      await fireEvent.changeText(
        screen.getByLabelText('Ваша відповідь'),
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
      expect(screen.getByLabelText('Ваша відповідь')).toBeOnTheScreen();
    });
    const standard = theStandardFormOfThePrompt();
    await fireEvent.changeText(screen.getByLabelText('Ваша відповідь'), 'хибне');
    await fireEvent(screen.getByLabelText('Ваша відповідь'), 'submitEditing');

    expect(screen.getByTestId('game-sheet-title')).toHaveTextContent('Не цього разу');
    expect(screen.getByTestId('game-sheet')).toHaveTextContent(new RegExp(standard));
    expect(screen.getByTestId('game-sheet-explanation')).toHaveTextContent(
      `Чому ${standard} краще.`,
    );
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
  });
});
