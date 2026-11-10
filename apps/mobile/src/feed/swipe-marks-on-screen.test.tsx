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
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { AccessibilityInfo } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

/** The UA Edition with the Knowledge switch on and the side swipes as `swipeMarks` says. */
function editionWith(swipeMarks: boolean): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, knowledge: 'on', swipeMarks: swipeMarks ? 'on' : 'off' },
  });
}

/** The UA Edition in effect. */
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
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** A Word of the Edition's first Category, with the Stress on its second letter. */
function word(id: string, lemma: string): Word {
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
  };
}

/** Opens the composition over two Words, «лагідний» kept as yesterday's Word of the Day. */
async function open(swipeMarks: boolean) {
  editionInEffect = editionWith(swipeMarks);
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  userState = await seedUserState(
    {
      onboardingFinished: '2026-09-01T09:00:00.000Z',
      wordOfTheDayArchive: { '2026-10-27': 'w_lahidnyi' },
    },
    { clock },
  );
  await reopen();
}

/** Opens the composition afresh over the same user state, as on the next launch. */
async function reopen() {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний')],
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
  // Reduce Motion on: the finger's demo loops for as long as the sheet is open,
  // which settling every timer would never finish. Its motion is tested in @slovo/ui.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
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

/** How far, in points, a drag goes before the Feed's swipe takes it, as on the device. */
const ACTIVATION = 12;

/** The Feed pages that draw an Entry card inside the side swipes. */
function swipedPages() {
  return screen.queryAllByTestId('swipe-card', hidden);
}

/** The Feed page of Yesterday's Word, found by its title. */
function yesterdayPage() {
  let node: ReturnType<typeof screen.getByText> | null = screen.getByText(
    'Пам’ятаєш вчорашнє слово?',
    hidden,
  );
  for (; node !== null; node = node.parent)
    if (/^feed-card-\d+$/.test(String((node.props as { testID?: unknown }).testID))) return node;
  throw new Error('Yesterday’s Word is on no Feed page');
}

/** Lets `ms` pass on the faked timers, short of the undo toast's own time. */
async function pass(ms: number, action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Swipes the current card right, which marks it Known with the side swipes on. 200 pt is past 40% of the unmeasured 360 pt card. */
async function swipeRight() {
  await pass(500, () => {
    fireGestureHandler(getByGestureTestId('entry-card-side-swipe'), [
      { state: State.BEGAN, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, translationX: 8, velocityX: 0 },
      { state: State.ACTIVE, translationX: 200, velocityX: 0 },
      { state: State.END, translationX: 200, velocityX: 0 },
    ]);
  });
}

/** One swipe up on the Feed, which turns it to the next page. */
async function swipeUp() {
  await pass(500, () => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
  });
}

describe('the side swipes on the Feed (ADR 0077)', () => {
  it('wrap the Entry cards with swipeMarks on', async () => {
    await open(true);
    await renderApp();

    expect(getByGestureTestId('entry-card-side-swipe')).toBeDefined();
    expect(
      within(screen.getByTestId('feed-card-0', hidden)).getByTestId('swipe-card', hidden),
    ).toBeOnTheScreen();
  });

  it('are not there with swipeMarks off', async () => {
    await open(false);
    await renderApp();

    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(swipedPages()).toHaveLength(0);
    expect(() => getByGestureTestId('entry-card-side-swipe')).toThrow();
  });

  it('leave Yesterday’s Word, a Feed Notice, without them', async () => {
    await open(true);
    await renderApp();

    const page = yesterdayPage();
    expect(swipedPages().length).toBeGreaterThan(0);
    expect(within(page).queryAllByTestId('swipe-card', hidden)).toHaveLength(0);
  });

  it('close the undo toast once the Feed turns to another page', async () => {
    await open(true);
    await renderApp();
    await swipeRight();
    expect(screen.getByTestId('undo-toast', hidden)).toBeOnTheScreen();

    await swipeUp();

    expect(screen.queryByTestId('undo-toast', hidden)).toBeNull();
  });
});

describe('the «⋯» sheet of an Entry card on the Feed', () => {
  it('closes with «Скасувати», as on the board (ADR 0092)', async () => {
    await open(true);
    await renderApp();
    const page = within(screen.getByTestId('feed-card-0'));
    await settle(() => fireEvent.press(page.getByRole('button', { name: 'Більше дій' })));

    const menu = within(screen.getByTestId('entry-menu'));
    expect(menu.getByRole('button', { name: 'Скасувати' })).toBeOnTheScreen();
    expect(menu.queryByRole('button', { name: 'Закрити' })).toBeNull();

    await settle(() => fireEvent.press(menu.getByRole('button', { name: 'Скасувати' })));
    // The sheet slides away.
    await waitFor(() => {
      expect(screen.queryByTestId('entry-menu')).toBeNull();
    });
  });
});
