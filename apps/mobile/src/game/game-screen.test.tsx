import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CrosswordDaySchema, type Correction, type Idiom, type Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Clock,
  type Composition,
  type Edition,
  type Haptics,
  type Schedule,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, systemSchedule } from '@slovo/ui';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import GameScreen from '../app/game';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';

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
let composition: Composition;

/** Whether the app is in the foreground, as a test moves it, and who listens to it. */
let mockInForeground = true;
const mockForegroundListeners = new Set<() => void>();

jest.mock('../foreground/in-foreground', () => ({
  useInForeground: () =>
    jest.requireActual<typeof import('react')>('react').useSyncExternalStore(
      (listener: () => void) => {
        mockForegroundListeners.add(listener);
        return () => {
          mockForegroundListeners.delete(listener);
        };
      },
      () => mockInForeground,
    ),
}));

/** Sends the app to the background, or brings it back to the foreground. */
async function moveApp(to: 'background' | 'foreground') {
  mockInForeground = to === 'foreground';
  await act(() => {
    for (const listener of mockForegroundListeners) listener();
  });
}

jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
jest.mock('../settings/settings', () => ({
  useSettings: () => ({ current: { hideStreak: false, selfCheck: false } }),
}));
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ navigate: () => undefined, push: () => undefined }),
  // The screen comes into view as it renders, as a tab's first screen does.
  useFocusEffect: (effect: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
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
 * A Correction of the given Correction Type, a calque unless said, with
 * nothing but what the Game reads: the non-standard «хибне» and its number in
 * a sentence of its own, the standard «добре» and its number.
 */
const correction = (
  index: number,
  correctionType: Correction['correctionType'] = 'calque',
): Correction => ({
  kind: 'correction',
  id: `c_test${String(index)}`,
  nonStandardForm: `хибне${String(index)}`,
  correctionType,
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

/**
 * An Idiom with nothing but what the Game reads: «перше» and its number, then
 * «друге» and «третє» after a comma and a dash, which are no chips, its
 * Definition «The sense of idiom{n}.».
 */
const idiom = (index: number): Idiom => ({
  kind: 'idiom',
  id: `i_test${String(index)}`,
  expression: `перше${String(index)}, друге — третє`,
  idiomType: 'idiom',
  primaryDefinition: `The sense of idiom${String(index)}.`,
  extraDefinitions: [],
  examples: [],
  sources: [{ title: 'Test source' }],
  retired: false,
});

/** The haptic of a wrong answer. */
const warning = jest.fn();

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning,
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * The Daily Crossword of the test's day, 26 October, of four words:
 *
 *     к і т
 *     о . а
 *     т . к и т
 */
const crosswordDay = CrosswordDaySchema.parse({
  date: '2026-10-26',
  words: [
    { entryId: 'w_cat', answer: 'кіт', clue: 'Звір', row: 0, column: 0, direction: 'across' },
    { entryId: 'w_tomcat', answer: 'кот', clue: 'Він же', row: 0, column: 0, direction: 'down' },
    { entryId: 'w_yes', answer: 'так', clue: 'Згода', row: 0, column: 2, direction: 'down' },
    { entryId: 'w_whale', answer: 'кит', clue: 'Ссавець', row: 2, column: 2, direction: 'across' },
  ],
});

/** Its letters by place, all of them right. */
const SOLVED = {
  '0,0': 'к',
  '0,1': 'і',
  '0,2': 'т',
  '1,0': 'о',
  '2,0': 'т',
  '1,2': 'а',
  '2,2': 'к',
  '2,3': 'и',
  '2,4': 'т',
};

/** The Ukrainian Edition's origin languages, in its order. */
const { originLanguages } = config as { originLanguages: { code: string; name: string }[] };

/** The language «слово{n}» comes from, when it has an origin: the Edition's languages in turn. */
const originOf = (index: number) => originLanguages[index % originLanguages.length];

/** The Word «слово{n}» with its origin and an etymology that names it. */
const withOrigin = (index: number): Word => ({
  ...word(index),
  origin: originOf(index)?.code,
  etymology: `Від test${String(index)}.`,
});

/**
 * Opens the composition over 15 Words, the first given number of them with
 * an origin, the given numbers of calque
 * Corrections, anglicisms (numbered after the calques) and Idioms and the
 * Daily Crossword of the day, with the given Best results by mode id and the
 * crossword's letters, typed on the given date, kept from before.
 */
async function open({
  best = {},
  corrections = 0,
  anglicisms = 0,
  idioms = 0,
  origins = 0,
  switchedOff = [],
  crossword,
  clock = { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
  schedule,
}: {
  origins?: number;
  best?: Record<string, number>;
  corrections?: number;
  anglicisms?: number;
  idioms?: number;
  switchedOff?: readonly string[];
  crossword?: { date: string; letters: Record<string, string> };
  /** The clock the Core reads; a stopped one on the morning of 26 October by default. */
  clock?: Clock;
  /** What the Core runs something later by; nothing by default. */
  schedule?: Schedule;
} = {}) {
  mockEdition = editionWithout(switchedOff);
  const records = new Map(
    Object.entries(best).map(([modeId, result]) => [`game.best.${modeId}`, JSON.stringify(result)]),
  );
  if (crossword !== undefined) records.set('crossword.progress', JSON.stringify(crossword));
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: Array.from({ length: 15 }, (_, i) => (i < origins ? withOrigin(i) : word(i))),
      corrections: [
        ...Array.from({ length: corrections }, (_, i) => correction(i)),
        ...Array.from({ length: anglicisms }, (_, i) => correction(corrections + i, 'anglicism')),
      ],
      idioms: Array.from({ length: idioms }, (_, i) => idiom(i)),
    }),
    crossword: {
      crosswordDay: (date) =>
        Promise.resolve(date === crosswordDay.date ? crosswordDay : undefined),
    },
    edition: mockEdition,
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: systemRandom,
    ...(schedule === undefined ? {} : { schedule }),
  });
}

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <HapticsProvider haptics={haptics}>
            <GameScreen />
          </HapticsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  // The Game plans its offers once the composition is open.
  await waitFor(() => {
    expect(screen.getByTestId('game-mode-guess-word').props['accessibilityState']).toEqual({
      disabled: false,
    });
  });
}

/** The titles over the mode cards and the mode cards, top to bottom, as VoiceOver meets them. */
function shape(): string[] {
  return within(screen.getByTestId('game-modes'))
    .getAllByRole(/^(header|button)$/)
    .map((node): unknown => node.props['testID'] ?? node.props['children'])
    .map(String)
    .filter((id) => id !== 'daily-crossword');
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

/**
 * Answers a Round of «Виживання» right or wrong: of a Word, its Definition
 * «The meaning of test{n}.» asks for «слово{n}»; of a Correction, the
 * sentence with «хибне{n}» for «добре{n}».
 */
async function answerSurvivalRound(right: boolean) {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  const n = /хибне(\d+)/.exec(prompt)?.[1];
  const answer = n === undefined ? `слово${/\d+/.exec(prompt)?.[0] ?? ''}` : `добре${n}`;
  const options = screen.getAllByRole('button', { name: /^(слово|добре)\d+/ });
  const option = options.find(
    (one) => String(one.props['accessibilityLabel']).split(',')[0] === answer,
  );
  const wrong = options.find((one) => one !== option);
  const tapped = right ? option : wrong;
  if (tapped === undefined) throw new Error(`No option for «${prompt}»`);
  await fireEvent.press(tapped);
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

/** Taps the shuffled word chips of a Round of «Склади вислів» in the order of the words. */
async function assembleWords(words: readonly string[]) {
  for (const text of words) {
    const chip = screen
      .getAllByTestId(/^chips-\d+$/)
      .find((one) => one.props['accessibilityLabel'] === text);
    if (chip === undefined) throw new Error(`No chip «${text}» left`);
    await fireEvent.press(chip);
  }
}

/** The words of the expression a Round of «Склади вислів» asks for, for the prompt's «The sense of idiom{n}.». */
function theWordsOfThePrompt(): string[] {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return [`перше${/idiom(\d+)/.exec(prompt)?.[1] ?? ''}`, 'друге', 'третє'];
}

/** The standard form a Round of «Впиши слово» asks for: «добре{n}» for the prompt's «хибне{n}». */
function theStandardFormOfThePrompt(): string {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return `добре${/хибне(\d+)/.exec(prompt)?.[1] ?? ''}`;
}

/** The number in the prompt of a pick Round: «хибне{n}» of a Correction or «перше{n}» of an Idiom. */
function theNumberOfThePrompt(): number {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return Number(/(?:хибне|перше)(\d+)/.exec(prompt)?.[1]);
}

/** The option whose text is the given one, as VoiceOver names it. */
const theOption = (text: string) =>
  screen.getByRole('button', { name: new RegExp(`^${text}(,|$)`) });

/** The Word a Round of «За буквами» or «Анаграми» asks about: «слово{n}», its Definition «The meaning of test{n}.». */
function theWordOfThePrompt(): string {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return `слово${/\d+/.exec(prompt)?.[0] ?? ''}`;
}

/** Picks an option other than the Word whose number is the prompt's, wrong in a Round of «Вгадай слово». */
async function pickAnotherWord() {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  const right = new RegExp(`^слово${/\d+/.exec(prompt)?.[0] ?? ''},`);
  const wrong = screen
    .getAllByTestId(/^game-option-\d+$/)
    .find((option) => !right.test(String(option.props['accessibilityLabel'])));
  if (wrong === undefined) throw new Error('No wrong option');
  await fireEvent.press(wrong);
}

/** The time left on the timer as VoiceOver reads it. */
const timerLabel = () => String(screen.getByTestId('game-timer').props['accessibilityLabel']);

/** Lets the given milliseconds pass on the faked clock and timers. */
async function pass(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** Plays a whole Game of «Наголос», started from its card unless said, each Round right, to the result screen. */
async function winStress({ fromCard = true } = {}) {
  if (fromCard) await fireEvent.press(screen.getByTestId('game-mode-stress'));
  for (let round = 1; round <= 15; round += 1) {
    await waitFor(() => {
      expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
    });
    await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
    await fireEvent.press(screen.getByTestId('game-next'));
  }
  await waitFor(() => {
    expect(screen.getByText('Перемога!')).toBeOnTheScreen();
  });
}

beforeEach(async () => {
  mockInForeground = true;
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

  it('shows each mode’s own Best result on its card, out of its Round limit', async () => {
    await open({ best: { 'guess-word': 12, correction: 7, survival: 23 } });
    await renderScreen();

    expect(
      within(screen.getByTestId('game-mode-guess-word')).getByText('Найкраще: 12 з 15'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('game-mode-correction')).getByText('Найкраще: 7 з 15'),
    ).toBeTruthy();
    // «Виживання» has no Round limit, so its Best result stands alone.
    expect(within(screen.getByTestId('game-mode-survival')).getByText('Найкраще: 23')).toBeTruthy();
  });

  it('shows no rules line under the title, so a Best result shows on its card alone', async () => {
    await open({ best: { 'guess-word': 12 } });
    await renderScreen();

    expect(screen.queryByText(/15 раундів, 5 життів/)).toBeNull();
    expect(screen.getAllByText(/Найкраще/)).toHaveLength(1);
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
      'game-mode-origin',
      'Вислови',
      'game-mode-idiom-meaning',
      'game-mode-build-idiom',
      'Виклик',
      'game-mode-timed',
    ]);
    expect(screen.queryByText('Виправлення')).toBeNull();
  });

  it('puts the Daily Crossword’s card with today’s date above the groups, offering «Почати»', async () => {
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(card).toHaveTextContent('Кросворд дня · 26 жовтня', { exact: false });
    expect(card.props['accessibilityLabel']).toBe('Кросворд дня · 26 жовтня. Почати');
    const cards = within(screen.getByTestId('game-modes'))
      .getAllByTestId(/^(daily-crossword|game-mode-.+)$/)
      .map((node): unknown => node.props['testID']);
    expect(cards[0]).toBe('daily-crossword');
    expect(cards.slice(1)).toContain('game-mode-guess-word');
  });

  it('offers «Продовжити» on the Daily Crossword’s card once some of today’s letters are in', async () => {
    await open({ crossword: { date: '2026-10-26', letters: { '0,0': 'к', '1,0': 'а' } } });
    await renderScreen();

    expect((await screen.findByTestId('daily-crossword')).props['accessibilityLabel']).toBe(
      'Кросворд дня · 26 жовтня. Продовжити',
    );
  });

  it('marks the Daily Crossword’s card solved once today’s is', async () => {
    await open({ crossword: { date: '2026-10-26', letters: SOLVED } });
    await renderScreen();

    const card = await screen.findByTestId('daily-crossword');
    expect(card.props['accessibilityLabel']).toBe('Кросворд дня · 26 жовтня. ✓ Розв’язано');
    expect(within(card).queryByText('Продовжити')).toBeNull();
  });

  it('offers «Почати» again on a new day, whatever the day before held', async () => {
    await open({ crossword: { date: '2026-10-25', letters: SOLVED } });
    await renderScreen();

    expect((await screen.findByTestId('daily-crossword')).props['accessibilityLabel']).toBe(
      'Кросворд дня · 26 жовтня. Почати',
    );
  });

  it('leaves out the Daily Crossword’s card with its Feature Switch off', async () => {
    await open({ switchedOff: ['dailyCrossword'] });
    await renderScreen();

    expect(screen.queryByTestId('daily-crossword')).toBeNull();
    expect(screen.getByTestId('game-mode-guess-word')).toBeOnTheScreen();
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
        /^Складіть вислів\. The sense of idiom\d+\.$/,
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
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
      // The pick Round of «Обери правильне»: the sentence, its non-standard form marked.
      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toMatch(
        /^Як сказати краще\? Речення (\d+): тут хибне\1\. Виділено: хибне\1$/,
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
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
        /^Що це означає\? перше\d+, друге — третє$/,
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
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
      expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe(
        `Життів: ${String(lives)} з 3`,
      );
      await fireEvent.press(screen.getByTestId('game-next'));
    }

    await waitFor(() => {
      expect(screen.getByText('Життя закінчилися')).toBeOnTheScreen();
    });
    expect(kinds).toEqual(new Set(['word', 'correction']));
    expect(screen.getByTestId('game-result-rounds')).toHaveTextContent(/^11 ?раунд/);
    expect(screen.getByTestId('game-result-rounds').props['accessibilityLabel']).toBe(
      'Пройдено раундів: 11',
    );
    expect(screen.getByTestId('game-result-best')).toHaveTextContent(/^11/);
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
      expect(screen.queryByTestId('game-progress')).toBeNull();
      expect(screen.queryByTestId('game-lives')).toBeNull();
      expect(screen.getByText('Визначення')).toBeOnTheScreen();
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
    expect(card).toHaveTextContent(/Замало слів із відомим походженням у вашому Міксі\./);
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
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Життів: 4 з 5');
    expect(warning).toHaveBeenCalled();
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
