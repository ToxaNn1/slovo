import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type FeatureSwitch, fill, STRESS_MARK, type Word } from '@slovo/contracts';
import {
  openComposition,
  systemRandom,
  type AnalyticsPort,
  type Composition,
  type CrossingWord,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GameScreen from '../app/game';
import GameLayout from '../app/game/_layout';
import DailyCrosswordScreen from '../app/game/crossword';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { SettingsProvider } from '../settings/settings';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SCREEN_OPEN_TIMEOUT_MS } from '../open-screen';
import { CROSSING_LEMMAS } from './crossing-crossword.test-support';

/** Lemmas of the Edition's alphabet, whose lengths fill the traced grid. */
const TRACEABLE = ['кіт', 'дім', 'вовк', 'сова', 'річка', 'весна', 'яблуко', 'зоря'];

/** The composition the screens read, opened afresh for each test. */
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

/** Sends the app to the background, or brings it back to the foreground, and lets the Core keep what it keeps. */
async function moveApp(to: 'background' | 'foreground') {
  mockInForeground = to === 'foreground';
  await settle(() => {
    for (const listener of mockForegroundListeners) listener();
  });
}

/** Passes this many seconds of the clock, tick by tick. */
const pass = (seconds: number) =>
  settle(() => {
    jest.advanceTimersByTime(seconds * 1000);
  });

/** A Word of one Category, with nothing but what the Game reads. */
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

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Runs what a tap starts, and lets the navigators and the Core finish it:
 * the test renderer runs on fake timers, and the crossing crossword's clock
 * ticks on an interval, so only the timers due so far run.
 */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    jest.runOnlyPendingTimers();
  });
}

/** The Analytics events the Core sent, by name and properties. */
let events: unknown[][] = [];

const analytics: AnalyticsPort = {
  track: (event, properties) => void events.push([event, properties]),
  stop: () => undefined,
};

/**
 * The Game tab as the app routes it, opened on its mode screen over a fresh
 * composition, with a Share Card capture when the binary has one.
 */
async function renderGame({
  crossing = false,
  on = [],
}: {
  crossing?: boolean;
  /** Feature Switches on over the Edition's, such as `crosswordSolveTime`. */
  on?: readonly FeatureSwitch[];
} = {}) {
  events = [];
  mockInForeground = true;
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [
        ...Array.from({ length: 15 }, (_, i) => word(i)),
        // Words of the Edition's alphabet, which can fill the traced grid.
        ...(crossing ? CROSSING_LEMMAS : TRACEABLE).map((lemma) => ({
          ...word(0),
          id: `w_${lemma}`,
          lemma,
          stress: [0],
        })),
      ],
    }),
    // The UA Edition ships the crossing Daily Crossword off, so the traced one shows (ADR 0073).
    edition: {
      ...edition,
      isFeatureEnabled: (feature) =>
        (crossing && feature === 'crossingCrossword') ||
        on.includes(feature) ||
        edition.isFeatureEnabled(feature),
    },
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    analytics,
  });
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(edition),
    settings: await settingsAt(),
  });
  const app = await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <SettingsProvider>
                <Slot />
              </SettingsProvider>
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      'game/_layout': GameLayout,
      'game/index': GameScreen,
      'game/crossword': DailyCrosswordScreen,
    },
    { initialUrl: '/game' },
  );
  await settle();
  return { pathname: () => app.getPathname() };
}

/** What the Daily Crossword's card on the mode screen reads. */
const card = () => String(screen.getByTestId('daily-crossword').props['accessibilityLabel']);

/**
 * Opens the crossword from its card, a while after the screen before opened:
 * the test renderer's stack reports no transition's end, so the screen
 * opener waits out its limit before it takes another tap.
 */
const openFromCard = () =>
  settle(() => {
    jest.advanceTimersByTime(SCREEN_OPEN_TIMEOUT_MS);
    return fireEvent.press(screen.getByTestId('daily-crossword'));
  });

/** Goes back from the crossword to the mode screen. */
const back = () => settle(() => fireEvent.press(screen.getByTestId('daily-crossword-screen-back')));

/** Today's crossing Daily Crossword as the composition opens it again, with the progress kept. */
async function crossing() {
  const opening = await composition.openCrossingCrossword();
  if (opening.kind !== 'open') throw new Error(`Expected the puzzle, got ${opening.kind}`);
  return opening.crossword;
}

const crossingPuzzle = async () => (await crossing()).puzzle;

/** The Solve time kept so far, in seconds. */
const keptSeconds = async () => (await crossing()).state.seconds;

const { dailyCrossword: texts } = editionStrings.game;

/** The clue bar's chip, such as «1→». */
const chip = ({ number, direction }: CrossingWord) =>
  within(screen.getByTestId('crossing-crossword-clue')).getByText(
    `${String(number)}${direction === 'across' ? '→' : '↓'}`,
  );

/** What VoiceOver reads for the clue bar's clue. */
const clueLabel = () =>
  String(screen.getByTestId('crossing-crossword-clue-clue').parent?.props['accessibilityLabel']);

const wordName = ({ number, direction }: CrossingWord) =>
  fill(texts.wordName, { number: String(number), direction: texts[direction] });

/**
 * Traces these tiles of the current Word's wheel the way VoiceOver does,
 * tile by tile as buttons, then «Перевірити».
 */
async function trace(tiles: readonly number[]) {
  for (const tile of tiles)
    await settle(() =>
      fireEvent.press(screen.getByTestId(`crossing-crossword-wheel-tile-${String(tile)}`)),
    );
  await settle(() => fireEvent.press(screen.getByText(texts.check)));
}

/** The tiles of a Word's wheel that spell it, each tile once. */
function tilesOf({ letters, wheel }: CrossingWord): number[] {
  const used = new Set<number>();
  return letters.map((letter) => {
    const tile = wheel.findIndex((candidate, i) => candidate === letter && !used.has(i));
    used.add(tile);
    return tile;
  });
}

/** Selects a Word by a tap on its first cell, and a second tap where it crosses another. */
async function selectWord(target: CrossingWord) {
  const { row, column } = target.start;
  const first = `crossing-crossword-grid-${String(row)}-${String(column)}`;
  await settle(() => fireEvent.press(screen.getByTestId(first)));
  if (!clueLabel().startsWith(`${wordName(target)}.`))
    await settle(() => fireEvent.press(screen.getByTestId(first)));
}

/** Selects a Word, then traces it right. */
async function solveWord(target: CrossingWord) {
  await selectWord(target);
  await trace(tilesOf(target));
}

describe('the crossing Daily Crossword (ADR 0087)', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  });

  it('opens from its card on the first Word’s clue, which a tap on a cell and «next» move', async () => {
    await renderGame({ crossing: true });
    await openFromCard();
    const { words } = await crossingPuzzle();
    const [first, second] = words;
    if (first === undefined || second === undefined) throw new Error('Expected two Words');

    expect(screen.getByTestId('crossing-crossword-grid')).toBeOnTheScreen();
    expect(screen.queryByTestId('traced-crossword-grid')).toBeNull();
    expect(screen.getByText('Веди пальцем по літерах, щоб скласти слово')).toBeOnTheScreen();
    expect(chip(first)).toBeOnTheScreen();
    expect(screen.getByTestId('crossing-crossword-clue-clue')).toHaveTextContent(first.clue);
    expect(clueLabel()).toBe(`${wordName(first)}. ${first.clue}`);

    await settle(() => fireEvent.press(screen.getByLabelText('Наступне слово')));
    expect(clueLabel()).toBe(`${wordName(second)}. ${second.clue}`);

    const down = words.find(({ direction }) => direction === 'down');
    if (down === undefined) throw new Error('Expected a Word down');
    await selectWord(down);
    expect(chip(down)).toBeOnTheScreen();
    expect(clueLabel()).toBe(`${wordName(down)}. ${down.clue}`);
  });

  it('fills the current Word traced by VoiceOver’s tiles and «Перевірити», and shortens the line', async () => {
    await renderGame({ crossing: true });
    await openFromCard();
    const [first] = (await crossingPuzzle()).words;
    if (first === undefined) throw new Error('Expected a Word');

    await trace(tilesOf(first));

    const { row, column } = first.start;
    const label = String(
      screen.getByTestId(`crossing-crossword-grid-${String(row)}-${String(column)}`).props[
        'accessibilityLabel'
      ],
    );
    expect(label.startsWith(`${first.letters[0] ?? ''}. `)).toBe(true);
    expect(label).toContain(wordName(first));
    expect(screen.getByText('Веди пальцем по літерах')).toBeOnTheScreen();
    expect(screen.queryByText('Десь закралася помилка. Шукай уважніше!')).toBeNull();
  });

  it('fills the first empty cell of the current Word by «Підказка» in the header', async () => {
    await renderGame({ crossing: true, on: ['crosswordHint'] });
    await openFromCard();
    const { words, prefilled } = await crossingPuzzle();
    const [first] = words;
    if (first === undefined) throw new Error('Expected a Word');
    const empty = first.letters.findIndex((_, i) => {
      const row = first.start.row + (first.direction === 'down' ? i : 0);
      const column = first.start.column + (first.direction === 'across' ? i : 0);
      return !prefilled.some(({ place }) => place.row === row && place.column === column);
    });
    const row = first.start.row + (first.direction === 'down' ? empty : 0);
    const column = first.start.column + (first.direction === 'across' ? empty : 0);
    const cellLabel = () =>
      String(
        screen.getByTestId(`crossing-crossword-grid-${String(row)}-${String(column)}`).props[
          'accessibilityLabel'
        ],
      );
    expect(cellLabel().startsWith(`${texts.emptyCell}. `)).toBe(true);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: 'Підказка' })));

    expect(cellLabel().startsWith(`${first.letters[empty] ?? ''}. `)).toBe(true);
  });

  it('shows no «Підказка» while the Crossword Hint is off', async () => {
    await renderGame({ crossing: true });
    await openFromCard();
    expect(screen.getByTestId('crossing-crossword-grid')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Підказка' })).toBeNull();
  });

  it('says «Десь закралася помилка. Шукай уважніше!» for a trace that spells no Word', async () => {
    await renderGame({ crossing: true });
    await openFromCard();
    const [first] = (await crossingPuzzle()).words;
    if (first === undefined) throw new Error('Expected a Word');
    const right = tilesOf(first);
    const decoy = first.wheel.findIndex((_, i) => !right.includes(i));
    const wrong = [decoy, ...right.slice(1)];

    await trace(wrong);

    expect(screen.getByTestId('crossing-crossword-miss')).toHaveTextContent(
      'Десь закралася помилка. Шукай уважніше!',
    );
    expect(screen.getByText('Веди пальцем по літерах, щоб скласти слово')).toBeOnTheScreen();
  });

  it('shows «Розв’язано!» once every Word is solved, and the card marks it solved', async () => {
    await renderGame({ crossing: true });
    await openFromCard();
    const { words } = await crossingPuzzle();

    for (const target of words) await solveWord(target);

    expect(screen.getByTestId('daily-crossword-solved')).toHaveTextContent('Розв’язано!');
    expect(screen.queryByTestId('crossing-crossword-wheel')).toBeNull();
    await back();
    expect(card()).toBe('Кросворд дня. 26 жовтня. ✓ Розв’язано');
  });
  it('counts the Solve time on screen only: it pauses in the background and on leave, and goes on when the reader comes back', async () => {
    await renderGame({ crossing: true, on: ['crosswordSolveTime'] });
    await openFromCard();
    await pass(5);
    await moveApp('background');
    const beforeBackground = await keptSeconds();
    expect(beforeBackground).toBeGreaterThanOrEqual(5);
    expect(beforeBackground).toBeLessThan(10);

    await pass(60);
    await moveApp('foreground');
    await pass(3);
    await back();
    const afterReturn = await keptSeconds();
    expect(afterReturn - beforeBackground).toBeGreaterThanOrEqual(3);
    expect(afterReturn - beforeBackground).toBeLessThan(10);

    await pass(60);
    expect(await keptSeconds()).toBe(afterReturn);
    await openFromCard();
    await pass(2);
    await back();
    const afterSecondVisit = await keptSeconds();
    expect(afterSecondVisit - afterReturn).toBeGreaterThanOrEqual(2);
    expect(afterSecondVisit - afterReturn).toBeLessThan(10);
  });

  it('keeps no time with crosswordSolveTime off', async () => {
    await renderGame({ crossing: true });
    await openFromCard();
    await pass(5);
    await back();
    expect(await keptSeconds()).toBe(0);
  });
});

describe('the traced Daily Crossword, with the crossing one off (ADR 0073)', () => {
  it('opens from its card, and with VoiceOver on locks a Word tapped cell by cell and checked', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await renderGame();
    await openFromCard();
    expect(await screen.findByTestId('traced-crossword-grid')).toBeOnTheScreen();
    expect(screen.queryByTestId('crossing-crossword-grid')).toBeNull();

    const opening = await composition.openTracedCrossword();
    if (opening.kind !== 'open') throw new Error('Expected the traced puzzle');
    const { puzzle } = opening.crossword;
    const [hidden] = puzzle.words;
    if (hidden === undefined) throw new Error('Expected a hidden Word');
    const { tracedCellLabel, clueFound, check } = editionStrings.game.dailyCrossword;
    for (const { row, column } of hidden.path) {
      const { letter, stressed } = puzzle.grid[row]?.[column] ?? { letter: '', stressed: false };
      const label = fill(tracedCellLabel, {
        letter: stressed ? `${letter}${STRESS_MARK}` : letter,
        row: String(row + 1),
        column: String(column + 1),
      });
      await settle(() => fireEvent.press(screen.getByLabelText(label)));
    }
    await settle(() => fireEvent.press(screen.getByText(check)));
    expect(
      screen.getByLabelText(fill(clueFound, { clue: hidden.clue, word: '' }), {
        exact: false,
      }),
    ).toBeOnTheScreen();
  });
});
