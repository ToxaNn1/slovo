// The Game screen's tests share this support: the Edition, the composition, the mocks and the reader's moves.
import { expect, jest } from '@jest/globals';
import { type Correction, type Idiom, type Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  systemRandom,
  type AnalyticsPort,
  type Clock,
  type Composition,
  type Edition,
  type Haptics,
  type Schedule,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState, type XpRecord } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider } from '@slovo/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GameScreen from '../app/game';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider, type ShareCard } from '../shell-value';
import { SettingsProvider } from '../settings/settings';
import {
  GAMES_BOARD_SWITCHES,
  opened,
  settingsAt,
  switchedTo,
  testShell,
  analyticsInto,
} from '../shell/test-support';
import { CROSSING_LEMMAS } from './crossing-crossword.test-support';

const { config } = activeEditionFiles;

/**
 * The Game Modes and the Daily Crossword the tests play though the UA Edition
 * hides them for now (owner, 15.11): on unless a test turns them off.
 */
const MODES_UNDER_TEST = [
  'gamePairs',
  'gameAnagram',
  'gameTypeWord',
  'gameByLetters',
  'gameSurvival',
  'gameBuildIdiom',
  'gameOrigin',
  'dailyCrossword',
];

/**
 * The UA Edition with the Games boards' switches off, the hidden modes and
 * the Daily Crossword on, the given Feature Switches turned off, and the others given turned on.
 */
export function editionWithout(
  switchedOff: readonly string[],
  switchedOn: readonly string[] = [],
  outOfMix: readonly string[] = [],
): Edition {
  const { featureSwitches, userSettingDefaults, ...rest } = config as {
    featureSwitches: Record<string, string>;
    userSettingDefaults: { mix: { kinds: Record<string, boolean> } };
  };
  const { mix } = userSettingDefaults;
  return loadEdition({
    ...rest,
    userSettingDefaults: {
      ...userSettingDefaults,
      mix: {
        ...mix,
        kinds: { ...mix.kinds, ...Object.fromEntries(outOfMix.map((kind) => [kind, false])) },
      },
    },
    featureSwitches: {
      ...featureSwitches,
      ...Object.fromEntries(GAMES_BOARD_SWITCHES.map((name) => [name, 'off'])),
      ...Object.fromEntries(MODES_UNDER_TEST.map((name) => [name, 'on'])),
      ...Object.fromEntries(switchedOff.map((name) => [name, 'off'])),
      ...Object.fromEntries(switchedOn.map((name) => [name, 'on'])),
    },
  });
}

/** The Edition the screen reads, as it ships unless a test turns a switch off. */
export let editionInEffect: Edition;

/** The composition the screen reads, opened afresh for each test. */
export let composition: Composition;

/** Whether the app is in the foreground, as a test moves it, and who listens to it. */
export let mockInForeground = true;
export const mockForegroundListeners = new Set<() => void>();

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
export async function moveApp(to: 'background' | 'foreground') {
  mockInForeground = to === 'foreground';
  await act(() => {
    for (const listener of mockForegroundListeners) listener();
  });
}

/** Where the screen led the reader, as `navigate` or `push` with its href, in order; emptied for each test. */
export const mockRouted: string[] = [];

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({
    navigate: (href: string) => {
      mockRouted.push(`navigate ${href}`);
    },
    push: (href: string) => {
      mockRouted.push(`push ${href}`);
    },
  }),
  // The screen comes into view as it renders, as a tab's first screen does.
  useFocusEffect: (effect: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

/**
 * A Word of one Category, with nothing but what the Game reads: «слово» and
 * its number, stressed on its first vowel, in an Example of its own.
 */
export const word = (index: number): Word => ({
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
export const correction = (
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
export const idiom = (index: number, longSense = false): Idiom => ({
  kind: 'idiom',
  id: `i_test${String(index)}`,
  expression: `перше${String(index)}, друге — третє`,
  idiomType: 'idiom',
  primaryDefinition: longSense
    ? `The sense of idiom${String(index)}, told at such length that it runs well past a sentence.`
    : `The sense of idiom${String(index)}.`,
  extraDefinitions: [],
  examples: [],
  sources: [{ title: 'Test source' }],
  retired: false,
});

/** The haptic of a wrong answer. */
export const warning = jest.fn();

export const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning,
};

export const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The UA Edition's origin languages, in its order. */
const { originLanguages } = config as { originLanguages: { code: string; name: string }[] };

/** The language «слово{n}» comes from, when it has an origin: the Edition's languages in turn. */
export const originOf = (index: number) => originLanguages[index % originLanguages.length];

/** The Word «слово{n}» with its origin and an etymology that names it. */
export const withOrigin = (index: number): Word => ({
  ...word(index),
  origin: originOf(index)?.code,
  etymology: `Від test${String(index)}.`,
});

/**
 * Opens the composition over 15 Words, the first given number of them with
 * an origin, the given numbers of calque
 * Corrections, anglicisms (numbered after the calques) and Idioms and the
 * Daily Crossword of the day, with the given Best results by mode id and the
 * crossword's letters, typed on the given date, kept from before, and the
 * given Feature Switches off or on.
 */
export async function open({
  best = {},
  corrections = 0,
  anglicisms = 0,
  idioms = 0,
  longSenses = false,
  origins = 0,
  switchedOff = [],
  switchedOn = [],
  outOfMix = [],
  crossing = false,
  clock = { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
  schedule,
  xp = [],
}: {
  /** XP earned before, each on its own day. */
  xp?: readonly { date: string; amount: number }[];
  origins?: number;
  best?: Record<string, number>;
  corrections?: number;
  anglicisms?: number;
  idioms?: number;
  /** Whether each Idiom's sense runs past a sentence. */
  longSenses?: boolean;
  switchedOff?: readonly string[];
  /** Feature Switches turned on, such as the Games boards' ones. */
  switchedOn?: readonly string[];
  /** Entry kinds the reader took out of their Mix, such as `correction`. */
  outOfMix?: readonly string[];
  /** Lemmas that fill the Daily Crossword, so a day opens one. */
  crossing?: boolean;
  /** The clock the Core reads; a stopped one on the morning of 26 October by default. */
  clock?: Clock;
  /** What the Core runs something later by; nothing by default. */
  schedule?: Schedule;
} = {}) {
  editionInEffect = editionWithout(switchedOff, switchedOn, outOfMix);
  const xpLog = Object.fromEntries(
    xp.map(({ date, amount }, index): [string, XpRecord] => [
      `seeded-${String(index)}`,
      { kind: 'xp', date, at: `${date}T07:00:00.000Z`, source: 'game-round', amount },
    ]),
  );
  const userState = await seedUserState({
    gameBest: best,
    xpLog,
  });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [
        ...Array.from({ length: 15 }, (_, i) => (i < origins ? withOrigin(i) : word(i))),
        ...(crossing
          ? CROSSING_LEMMAS.map((lemma) => ({ ...word(0), id: `w_${lemma}`, lemma, stress: [0] }))
          : []),
      ],
      corrections: [
        ...Array.from({ length: corrections }, (_, i) => correction(i)),
        ...Array.from({ length: anglicisms }, (_, i) => correction(corrections + i, 'anglicism')),
      ],
      idioms: Array.from({ length: idioms }, (_, i) => idiom(i, longSenses)),
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: systemRandom,
    analytics: analyticsInto(analytics),
    ...(schedule === undefined ? {} : { schedule }),
  });
}

/** The Analytics events the Core sent, by name and properties. */
export let events: unknown[][] = [];

export const analytics: AnalyticsPort = {
  track: (event, properties) => void events.push([event, properties]),
  stop: () => undefined,
};

/** A Share Card capture whose share sheet the reader always sends. */
export const sendingShareCard: ShareCard = (_view, _cardId, _format, onShared) => {
  onShared();
  return Promise.resolve('closed');
};

export async function renderScreen({
  shareCard,
  settings = {},
}: { shareCard?: ShareCard; settings?: Parameters<typeof settingsAt>[0] } = {}) {
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionInEffect),
    settings: await settingsAt(settings),
    shareCard,
  });
  await renderInGestureRoot(
    // The screen inside the providers it reads; a `.ts` module, so no JSX.
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <HapticsProvider haptics={haptics}>
            <SettingsProvider>
              <GameScreen />
            </SettingsProvider>
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
export function shape(): string[] {
  return within(screen.getByTestId('game-modes'))
    .getAllByRole(/^(header|button)$/)
    .map((node): unknown => node.props['testID'] ?? node.props['children'])
    .map(String)
    .filter((id) => id !== 'daily-crossword');
}

/** A pairs grid's cells with the ones gone, which VoiceOver skips, so that a place counts them too. */
export const ALL_CELLS = { includeHiddenElements: true };

/**
 * The pairs of the grid on the screen still to match: the place of each Word
 * left among the Words with the place of its own Definition, «слово{n}»'s
 * being «The meaning of test{n}.».
 */
export function pairsLeft(): { word: number; definition: number }[] {
  const definitions = screen
    .getAllByTestId(/^pairs-definition-\d+$/, ALL_CELLS)
    .map((cell): unknown => cell.props['accessibilityLabel']);
  return screen.getAllByTestId(/^pairs-word-\d+$/, ALL_CELLS).flatMap((cell, word) => {
    // A pair gone leaves its place empty, which VoiceOver skips.
    if (screen.queryByTestId(`pairs-word-${String(word)}`) === null) return [];
    const n = /\d+/.exec(String(cell.props['accessibilityLabel']))?.[0] ?? '';
    return [{ word, definition: definitions.indexOf(`The meaning of test${n}.`) }];
  });
}

/** Picks the option of the Word whose number is the prompt's, right in a Round of «Вгадай слово». */
export async function pickTheWordOfThePrompt() {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  const n = /\d+/.exec(prompt)?.[0] ?? '';
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^слово${n},`) }));
}

/**
 * Answers a Round of «Виживання» right or wrong: of a Word, its Definition
 * «The meaning of test{n}.» asks for «слово{n}»; of a Correction, the
 * sentence with «хибне{n}» for «добре{n}».
 */
export async function answerSurvivalRound(right: boolean) {
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
export async function startGuessWordAtRound11() {
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
export async function assemble(text: string) {
  for (const letter of text) {
    const chip = screen
      .getAllByTestId(/^chips-\d+$/)
      .find((one) => one.props['accessibilityLabel'] === letter);
    if (chip === undefined) throw new Error(`No chip «${letter}» left`);
    await fireEvent.press(chip);
  }
}

/** Taps the shuffled word chips of a Round of «Склади вислів» in the order of the words. */
export async function assembleWords(words: readonly string[]) {
  for (const text of words) {
    const chip = screen
      .getAllByTestId(/^chips-\d+$/)
      .find((one) => one.props['accessibilityLabel'] === text);
    if (chip === undefined) throw new Error(`No chip «${text}» left`);
    await fireEvent.press(chip);
  }
}

/** The words of the expression a Round of «Склади вислів» asks for, for the prompt's «The sense of idiom{n}.». */
export function theWordsOfThePrompt(): string[] {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return [`перше${/idiom(\d+)/.exec(prompt)?.[1] ?? ''}`, 'друге', 'третє'];
}

/** The standard form a Round of «Впиши слово» asks for: «добре{n}» for the prompt's «хибне{n}». */
export function theStandardFormOfThePrompt(): string {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return `добре${/хибне(\d+)/.exec(prompt)?.[1] ?? ''}`;
}

/** The number in the prompt of a pick Round: «хибне{n}» of a Correction or «перше{n}» of an Idiom. */
export function theNumberOfThePrompt(): number {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return Number(/(?:хибне|перше)(\d+)/.exec(prompt)?.[1]);
}

/** The option whose text is the given one, as VoiceOver names it. */
export const theOption = (text: string) =>
  screen.getByRole('button', { name: new RegExp(`^${text}(,|$)`) });

/** The Word a Round of «За літерами» or «Анаграми» asks about: «слово{n}», its Definition «The meaning of test{n}.». */
export function theWordOfThePrompt(): string {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  return `слово${/\d+/.exec(prompt)?.[0] ?? ''}`;
}

/** Picks an option other than the Word whose number is the prompt's, wrong in a Round of «Вгадай слово». */
export async function pickAnotherWord() {
  const prompt = String(screen.getByTestId('game-prompt').props['accessibilityLabel']);
  const right = new RegExp(`^слово${/\d+/.exec(prompt)?.[0] ?? ''},`);
  const wrong = screen
    .getAllByTestId(/^game-option-\d+$/)
    .find((option) => !right.test(String(option.props['accessibilityLabel'])));
  if (wrong === undefined) throw new Error('No wrong option');
  await fireEvent.press(wrong);
}

/** The time left on the timer as VoiceOver reads it. */
export const timerLabel = () =>
  String(screen.getByTestId('game-timer').props['accessibilityLabel']);

/** Lets the given milliseconds pass on the faked clock and timers. */
export async function pass(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** Puts the screen back as a test finds it: the app in the foreground, no events, the composition opened afresh. */
export async function resetGameScreen() {
  mockInForeground = true;
  events = [];
  mockRouted.length = 0;
  await open();
}
