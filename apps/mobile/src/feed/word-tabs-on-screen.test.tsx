import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

/** The UA Edition in effect, with `calligraphy` as the test sets it. */
let editionInEffect: Edition;

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

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

/** A Word of the Edition's first Category, with the Stress on its second letter. */
function word(id: string, lemma: string, more: Partial<Word> = {}): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [1],
    partOfSpeech: 'adjective',
    primaryDefinition: `Значення слова ${lemma}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'emotions-character',
    rarity: 3,
    sources: [{ title: 'Словник' }],
    correctionIds: [],
    retired: false,
    ...more,
  };
}

/** Opens the composition over the Word of the Day and `second`, with `wordTabs` on or off. */
async function open(second: Word, wordTabs = true) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'wordTabs'
        ? wordTabs
        : // No later question takes the Word of the Day's place in the Feed.
          feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature),
  };
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  // The gestures hint was shown on an earlier launch: its finger demo loops for as long as
  // the sheet is open, which settling every timer would never finish. It has its own test.
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z', gesturesHintShown: true },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [second, word('w_lahidnyi', 'лагідний')],
    }),
    edition: editionInEffect,
    userState: userState,
    clock,
    // The first Word in each draw, so each opening shows the same Word of the Day.
    random: { next: () => 0 },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

/** The Shell the app draws under: the settings and the composition over the test's user state. */
const shell = () =>
  testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });

/** The app on the Feed. */
async function renderApp() {
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell()}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <SettingsProvider>
                    <Slot />
                  </SettingsProvider>
                </HapticsProvider>
              </EditionProvider>
            </ShellProvider>
          </TokensProvider>
        </SafeAreaProvider>
      ),
      index: HomeScreen,
    },
    { initialUrl: '/' },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

const hidden = { includeHiddenElements: true };

/** How far a pan moves before the Feed's swipe takes it. */
const ACTIVATION = 12;

/** One swipe up from the Word of the Day, which brings the other Word's card on screen. */
async function swipeUp() {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
    await jest.advanceTimersByTimeAsync(500);
  });
}

/** The card of the Word that is not the Word of the Day: the one drawn in tabs. */
function wordCard() {
  const card = screen
    .getAllByTestId('word-card', hidden)
    .find((each) => within(each).queryByTestId('word-of-the-day-badge', hidden) === null);
  if (card === undefined) throw new Error('No Word card besides the Word of the Day');
  return within(card);
}

/** The tabs of the Word card, by their names, with whether each is selected. */
function tabsOf(card: ReturnType<typeof wordCard>) {
  const selected = card.queryAllByRole('tab', { ...hidden, selected: true });
  return card.queryAllByRole('tab', hidden).map((tab) => ({
    name: tab.props['accessibilityLabel'],
    selected: selected.includes(tab),
  }));
}

/** A Word with every tab filled: Examples, links, more meanings and an etymology. */
const fullWord = word('w_sumyrnyi', 'сумирний', {
  examples: [{ text: 'Сумирний кінь стояв тихо.', author: 'Іван Франко' }],
  synonyms: ['тихий'],
  antonyms: ['буйний'],
  extraDefinitions: ['Покірний.', 'Миролюбний.'],
  etymology: 'Від «мир».',
});

describe('the tabs of a Word card in the Feed', () => {
  it('shows the four tabs, «Суть» selected with the Definition', async () => {
    await open(fullWord);
    await renderApp();

    const card = wordCard();
    expect(tabsOf(card)).toEqual([
      { name: 'Суть', selected: true },
      { name: 'Приклад', selected: false },
      { name: 'Зв’язки', selected: false },
      { name: 'Історія', selected: false },
    ]);
    expect(card.getByText('Значення слова сумирний.', hidden)).toBeTruthy();
    expect(card.queryByText('Сумирний кінь стояв тихо.', hidden)).toBeNull();
  });

  it('shows the Example and its author on «Приклад», the Lemma and the corner kept', async () => {
    await open(fullWord);
    await renderApp();
    await swipeUp();
    const corner = () =>
      wordCard().queryByTestId('word-corner', hidden) ??
      wordCard().queryByTestId('word-actions', hidden);
    expect(corner()).not.toBeNull();

    await settle(() => fireEvent.press(wordCard().getByTestId('word-tab-example')));

    const card = wordCard();
    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Приклад');
    expect(card.getByText(/Сумирний кінь стояв тихо\./, hidden)).toBeTruthy();
    expect(card.getByText(/Іван Франко/, hidden)).toBeTruthy();
    expect(card.queryByText('Значення слова сумирний.', hidden)).toBeNull();
    expect(card.getByTestId('word-lemma', hidden)).toBeTruthy();
    expect(corner()).not.toBeNull();
  });

  it('leaves out «Зв’язки» for a Word without Synonyms and antonyms', async () => {
    await open({ ...fullWord, synonyms: [], antonyms: [] });
    await renderApp();

    expect(tabsOf(wordCard()).map(({ name }) => name)).toEqual(['Суть', 'Приклад', 'Історія']);
  });

  it('draws no tab bar when «Суть» is the only tab with anything in it', async () => {
    await open(word('w_sumyrnyi', 'сумирний'));
    await renderApp();

    const card = wordCard();
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Значення слова сумирний.', hidden)).toBeTruthy();
  });

  it('counts the other meanings in «Суть» and numbers them in «Історія»', async () => {
    await open(fullWord);
    await renderApp();
    await swipeUp();
    expect(wordCard().getByText('Ще 2 значення — у вкладці «Історія».', hidden)).toBeTruthy();

    await settle(() => fireEvent.press(wordCard().getByTestId('word-tab-history')));

    const card = wordCard();
    expect(card.getByText('1. Покірний.', hidden)).toBeTruthy();
    expect(card.getByText('2. Миролюбний.', hidden)).toBeTruthy();
  });

  it('keeps the column with «Детальніше» with `wordTabs` off', async () => {
    await open(fullWord, false);
    await renderApp();

    const card = wordCard();
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Детальніше', hidden)).toBeTruthy();
    expect(card.getByText('Значення слова сумирний.', hidden)).toBeTruthy();
  });
});
