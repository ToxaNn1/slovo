import { describe, expect, it, jest } from '@jest/globals';
import { CrosswordDaySchema, type Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GameScreen from '../app/game';
import GameLayout from '../app/game/_layout';
import DailyCrosswordScreen from '../app/game/crossword';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { SettingsProvider } from '../settings/settings';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SCREEN_OPEN_TIMEOUT_MS } from '../entries/open-screen';

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

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

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Runs what a tap starts, and lets the navigators and the Core finish it:
 * the test renderer runs on fake timers.
 */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    jest.runAllTimers();
  });
}

/** The Game tab as the app routes it, opened on its mode screen over a fresh composition. */
async function renderGame() {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: Array.from({ length: 15 }, (_, i) => word(i)),
    }),
    crossword: {
      crosswordDay: (date) =>
        Promise.resolve(date === crosswordDay.date ? crosswordDay : undefined),
    },
    edition,
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(edition),
    settings: await settingsAt(),
  });
  const app = renderRouter(
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
  await app;
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

/** What VoiceOver reads for the cell at a row and column. */
const cell = (row: number, column: number) =>
  String(
    screen.getByTestId(`daily-crossword-grid-${String(row)}-${String(column)}`).props[
      'accessibilityLabel'
    ],
  );

/** Taps a cell, which selects it and its word. */
const tap = (row: number, column: number) =>
  settle(() =>
    fireEvent.press(screen.getByTestId(`daily-crossword-grid-${String(row)}-${String(column)}`)),
  );

/** Types letters on the keyboard, one by one, into the selected word. */
async function type(letters: string) {
  for (const letter of letters)
    await settle(() =>
      fireEvent.changeText(screen.getByTestId('daily-crossword-grid-keyboard'), letter),
    );
}

describe('the Daily Crossword screen', () => {
  it('opens from its card with the grid and the first word’s clue', async () => {
    const app = await renderGame();
    expect(card()).toBe('Кросворд дня · 26 жовтня. Почати');

    await openFromCard();

    expect(app.pathname()).toBe('/game/crossword');
    expect(screen.getByText('Кросворд дня')).toBeOnTheScreen();
    expect(screen.getByTestId('daily-crossword-grid-clue')).toHaveTextContent('Звір');
    expect(cell(0, 0)).toBe('перша літера, порожня. Звір. Рядок 1, стовпець 1');
    expect(screen.getByTestId('daily-crossword-grid-open-letter')).toBeOnTheScreen();
  });

  it('fills the selected word as the reader types, and shows a crossing word’s clue on a tap', async () => {
    await renderGame();
    await openFromCard();

    await type('кі');
    await tap(1, 2);

    expect(cell(0, 0)).toBe('к, перша літера. Звір. Рядок 1, стовпець 1');
    expect(cell(0, 1)).toBe('і, друга літера. Звір. Рядок 1, стовпець 2');
    expect(cell(1, 2)).toBe('друга літера, порожня. Згода. Рядок 2, стовпець 3');
    expect(screen.getByTestId('daily-crossword-grid-clue')).toHaveTextContent('Згода');
  });

  it('opens the selected cell’s right letter with «Відкрити літеру»', async () => {
    await renderGame();
    await openFromCard();

    await settle(() => fireEvent.press(screen.getByText('Відкрити літеру')));

    expect(cell(0, 0)).toBe('к, перша літера. Звір. Рядок 1, стовпець 1');
  });

  it('keeps the letters on leaving, and the card offers «Продовжити»', async () => {
    await renderGame();
    await openFromCard();
    await type('кі');

    await back();
    expect(card()).toBe('Кросворд дня · 26 жовтня. Продовжити');

    await openFromCard();
    expect(cell(0, 0)).toBe('к, перша літера. Звір. Рядок 1, стовпець 1');
    expect(cell(0, 1)).toBe('і, друга літера. Звір. Рядок 1, стовпець 2');
  });

  it('shows «Розв’язано!» once solved, and the card marks it solved', async () => {
    await renderGame();
    await openFromCard();

    await type('кіт');
    await tap(1, 0);
    await type('от');
    await tap(1, 2);
    await type('ак');
    await tap(2, 3);
    await type('ит');

    expect(screen.getByText('Розв’язано!')).toBeOnTheScreen();
    expect(screen.queryByText('Відкрити літеру')).toBeNull();
    await back();
    expect(card()).toBe('Кросворд дня · 26 жовтня. ✓ Розв’язано');
  });
});
