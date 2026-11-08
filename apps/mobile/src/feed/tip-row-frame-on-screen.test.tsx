import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SynonymRow, Tip, Word } from '@slovo/contracts';
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

/** The Word of the Day the Feed opens on. */
const wordOfTheDay: Word = {
  kind: 'word',
  id: 'w_lahidnyi',
  lemma: 'лагідний',
  stress: [1],
  partOfSpeech: 'adjective',
  primaryDefinition: 'Ніжний.',
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
};

const tip: Tip = {
  kind: 'tip',
  id: 't_hour',
  title: 'Котра година?',
  nonStandardForm: 'Скільки часу?',
  standardForm: 'Котра година?',
  explanation: 'Час не рахують, а питають, котра година.',
  example: { text: 'Котра година, пане?', author: 'Леся Українка' },
  sources: [{ title: 'Антоненко-Давидович. Як ми говоримо' }],
  gameQuestion: {
    prompt: 'Як спитати?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['A', 'B', 'C'],
  },
  retired: false,
};

const members = ['простувати', 'чимчикувати', 'шкандибати', 'дибати', 'чалапати', 'плентатися'];

const row: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_walk',
  dominant: { text: 'іти', stress: [0] },
  meaning: 'Рухатися пішки.',
  members: members.map((text) => ({ text, stress: [0] })),
  sources: [{ title: 'Словник синонімів' }],
  retired: false,
};

/** Opens the composition over the Word of the Day and one Tip or one Synonym Row, with `wordTabs` on or off. */
async function open(entry: { tips: Tip[] } | { synonymRows: SynonymRow[] }, wordTabs = true) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'wordTabs'
        ? wordTabs
        : feature === 'tips' || feature === 'synonymRows'
          ? true
          : // No later question takes the Word of the Day's place in the Feed.
            feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature),
  };
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  // The gestures hint was shown on an earlier launch.
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z', gesturesHintShown: true },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [wordOfTheDay],
      ...entry,
    }),
    edition: editionInEffect,
    userState: userState,
    clock,
    // The first Entry in each draw, so each opening shows the same cards.
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

/** The card of `kind` on screen, after as many swipes up as it takes to bring it there. */
async function cardOf(kind: 'tip' | 'synonymRow') {
  for (let swipes = 0; swipes < 4; swipes += 1) {
    const card = screen.queryAllByTestId(`${kind}-card`)[0];
    if (card !== undefined) return within(card);
    await swipeUp();
  }
  throw new Error(`No ${kind} card in the Feed`);
}

/** The tabs of a card, by their names, with whether each is selected. */
function tabsOf(card: Awaited<ReturnType<typeof cardOf>>) {
  const selected = card.queryAllByRole('tab', { ...hidden, selected: true });
  return card.queryAllByRole('tab', hidden).map((tab) => ({
    name: String(tab.props['accessibilityLabel']),
    selected: selected.includes(tab),
  }));
}

/** The members a Synonym Row card draws, in order, without their Stress marks. */
function membersOf(card: Awaited<ReturnType<typeof cardOf>>) {
  return card
    .getAllByTestId(/^synonym-row-member-/, hidden)
    .map((member) => String(member.props['accessibilityLabel']).split(',')[0]);
}

describe('the Tip card in the fixed frame', () => {
  it('shows «Суть» selected with the standard form and the explanation, and «Приклад»', async () => {
    await open({ tips: [tip] });
    await renderApp();

    const card = await cardOf('tip');
    expect(tabsOf(card)).toEqual([
      { name: 'Суть', selected: true },
      { name: 'Приклад', selected: false },
    ]);
    expect(card.getByText('Скільки часу?', hidden)).toBeTruthy();
    expect(card.getByText('Час не рахують, а питають, котра година.', hidden)).toBeTruthy();
    expect(card.queryByText(/Котра година, пане\?/, hidden)).toBeNull();
    expect(card.queryByText('Винятки', hidden)).toBeNull();
  });

  it('shows the Example and its author on «Приклад», the title kept above the tabs', async () => {
    await open({ tips: [tip] });
    await renderApp();

    const card = await cardOf('tip');
    await settle(() => fireEvent.press(card.getByTestId('tip-tab-example')));

    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Приклад');
    expect(card.getByText(/Котра година, пане\?/, hidden)).toBeTruthy();
    expect(card.getByText(/Леся Українка/, hidden)).toBeTruthy();
    expect(card.queryByText('Час не рахують, а питають, котра година.', hidden)).toBeNull();
    expect(card.getByTestId('tip-title', hidden)).toBeTruthy();
  });

  it('draws no tab bar for a Tip without an Example', async () => {
    await open({ tips: [{ ...tip, example: undefined }] });
    await renderApp();

    const card = await cardOf('tip');
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Час не рахують, а питають, котра година.', hidden)).toBeTruthy();
  });

  it('clamps a Tip too long for the frame under «Детальніше», which opens it whole (owner 08.11)', async () => {
    await open({ tips: [tip] });
    await renderApp();
    const card = await cardOf('tip');
    const layout = async (testID: string, height: number) => {
      await fireEvent(card.getByTestId(testID, hidden), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
      });
      await settle();
    };
    await layout('tip-tab-panel', 120);
    for (let size = 0; size < 4 && card.queryByTestId('tip-tab-more', hidden) === null; size++)
      await layout('tip-tab-content', 900);

    expect(card.getByTestId('tip-tab-more', hidden)).toHaveTextContent(
      editionStrings.wordCard.tabMore,
    );
    await settle(() => fireEvent.press(card.getByTestId('tip-tab-more', hidden)));

    expect(card.queryByTestId('tip-tab-more', hidden)).toBeNull();
    expect(card.getByText('Час не рахують, а питають, котра година.', hidden)).toBeTruthy();
  });

  it("keeps today's card with its Example in one column with `wordTabs` off", async () => {
    await open({ tips: [tip] }, false);
    await renderApp();

    const card = await cardOf('tip');
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Час не рахують, а питають, котра година.', hidden)).toBeTruthy();
    expect(card.getByText(/Котра година, пане\?/, hidden)).toBeTruthy();
  });
});

describe('the Synonym Row card in the fixed frame', () => {
  it('shows the meaning and every member, with no tab bar and no pages', async () => {
    await open({ synonymRows: [row] });
    await renderApp();

    const card = await cardOf('synonymRow');
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Рухатися пішки.', hidden)).toBeTruthy();
    expect(membersOf(card)).toEqual(members);
    expect(card.getByTestId('synonymRow-tab-panel', hidden)).toBeTruthy();
  });

  it("keeps today's card with `wordTabs` off", async () => {
    await open({ synonymRows: [row] }, false);
    await renderApp();

    const card = await cardOf('synonymRow');
    expect(card.queryByTestId('synonymRow-tab-panel', hidden)).toBeNull();
    expect(membersOf(card)).toEqual(members);
  });
});
