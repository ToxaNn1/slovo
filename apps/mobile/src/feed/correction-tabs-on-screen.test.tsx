import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
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

/** A Correction of the Edition's correction Category, with every block filled. */
const correction: Correction = {
  kind: 'correction',
  id: 'c_slidujuchyi',
  nonStandardForm: 'слідуючий',
  correctionType: 'russianism',
  standardEquivalents: ['наступний', 'другий'],
  explanation: 'Дієприкметник на -учий не властивий українській мові.',
  examplePair: { nonStandard: 'Слідуючий тиждень.', standard: 'Наступний тиждень.' },
  categoryId: 'everyday',
  sources: [{ title: 'Словник' }],
  literaryUses: [],
  retired: false,
};

/** Opens the composition over the Word of the Day and a Correction, with `wordTabs` on or off. */
async function open(wordTabs = true) {
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
      correctionCategories: [
        { id: 'everyday', displayName: 'Щодня', description: 'Щодня.', tone: 'loud' },
      ],
      words: [word('w_lahidnyi', 'лагідний')],
      corrections: [correction],
    }),
    edition: editionInEffect,
    userState: userState,
    clock,
    // The first Entry in each draw, so each opening shows the same Word of the Day.
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

/** One swipe up from the Word of the Day, which brings the Correction's card on screen. */
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

/** The Correction's card. */
function correctionCard() {
  return within(screen.getByTestId('correction-card', hidden));
}

/** The tabs of the Correction card, by their names, with whether each is selected. */
function tabsOf(card: ReturnType<typeof correctionCard>) {
  const selected = card.queryAllByRole('tab', { ...hidden, selected: true });
  return card.queryAllByRole('tab', hidden).map((tab) => ({
    name: String(tab.props['accessibilityLabel']),
    selected: selected.includes(tab),
  }));
}

describe('the tabs of a Correction card in the Feed', () => {
  it('shows the struck form above «Як краще», «Чому», «Приклади» and «Джерело», «Як краще» selected', async () => {
    await open();
    await renderApp();
    await swipeUp();

    const card = correctionCard();
    expect(card.getByTestId('correction-non-standard', hidden)).toHaveTextContent(/Слідуючий/);
    expect(tabsOf(card)).toEqual([
      { name: 'Як краще', selected: true },
      { name: 'Чому', selected: false },
      { name: 'Приклади', selected: false },
      { name: 'Джерело', selected: false },
    ]);
    expect(card.getByTestId('correction-standard', hidden)).toBeTruthy();
    expect(card.getByText(/другий/, hidden)).toBeTruthy();
    expect(card.getByText('Щодня', hidden)).toBeTruthy();
    expect(
      card.queryByText('Дієприкметник на -учий не властивий українській мові.', hidden),
    ).toBeNull();
    expect(card.queryByText('Наступний тиждень.', hidden)).toBeNull();
  });

  it('shows the reason in place on «Чому», the struck form kept and the sources left to «Джерело»', async () => {
    await open();
    await renderApp();
    await swipeUp();

    await settle(() => fireEvent.press(correctionCard().getByTestId('correction-tab-why')));

    const card = correctionCard();
    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Чому');
    expect(
      card.getByText('Дієприкметник на -учий не властивий українській мові.', hidden),
    ).toBeTruthy();
    expect(card.queryByText('Джерело: Словник', hidden)).toBeNull();
    expect(card.queryByTestId('correction-standard', hidden)).toBeNull();
    expect(card.getByTestId('correction-non-standard', hidden)).toHaveTextContent(/Слідуючий/);
  });

  it('names the sources one to a line on «Джерело», with no «Джерело:» before them (ADR 0116)', async () => {
    await open();
    await renderApp();
    await swipeUp();

    await settle(() => fireEvent.press(correctionCard().getByTestId('correction-tab-source')));

    const card = correctionCard();
    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Джерело');
    expect(card.getByTestId('correction-source-0', hidden)).toHaveTextContent('Словник', {
      exact: true,
    });
    expect(
      card.queryByText('Дієприкметник на -учий не властивий українській мові.', hidden),
    ).toBeNull();
  });

  it('shows the example pair on «Приклади»', async () => {
    await open();
    await renderApp();
    await swipeUp();

    await settle(() => fireEvent.press(correctionCard().getByTestId('correction-tab-examples')));

    const card = correctionCard();
    expect(card.getByText('Слідуючий тиждень.', hidden)).toBeTruthy();
    expect(card.getByText('Наступний тиждень.', hidden)).toBeTruthy();
    expect(
      card.queryByText('Дієприкметник на -учий не властивий українській мові.', hidden),
    ).toBeNull();
  });

  it("keeps today's column with `wordTabs` off", async () => {
    await open(false);
    await renderApp();
    await swipeUp();

    const card = correctionCard();
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByTestId('correction-standard', hidden)).toBeTruthy();
    expect(card.getByText(/другий/, hidden)).toBeTruthy();
    expect(
      card.getByText('Дієприкметник на -учий не властивий українській мові.', hidden),
    ).toBeTruthy();
    expect(card.getByText('Наступний тиждень.', hidden)).toBeTruthy();
  });
});
