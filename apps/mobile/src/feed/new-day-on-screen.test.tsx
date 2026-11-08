import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Clock,
  type Composition,
  type Edition,
  type Haptics,
  type TrackedUserState,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import type { AppStateStatus } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/feed';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider, type Shell } from '../shell-value';
import { listen } from '../shell/lifecycle';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

/** The time the fake timers keep, in the reader's time zone, so moving the timers moves the clock. */
const clock: Clock = { now: () => new Date(Date.now()), timeZone: () => 'Europe/Kyiv' };

/** Two minutes to midnight on Tuesday 3 November in Kyiv. */
const BEFORE_MIDNIGHT = new Date('2026-11-03T21:58:00Z');

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

const hidden = { includeHiddenElements: true };

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

/** The device's app state, which the test moves. */
function fakeAppState() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const source = {
    currentState: 'active' as AppStateStatus,
    addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  return {
    source,
    moveTo(state: AppStateStatus) {
      source.currentState = state;
      for (const listener of listeners) listener(state);
    },
  };
}

let userState: TrackedUserState;
let composition: Composition;
let editionInEffect: Edition;
let stopLifecycle: () => void = () => undefined;

beforeEach(() => {
  jest.useFakeTimers({ now: BEFORE_MIDNIGHT });
});

afterEach(() => {
  stopLifecycle();
  jest.useRealTimers();
  screenSettled();
});

/** Lets the screen and the Core settle, a second on the clock. */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.advanceTimersByTimeAsync(1000);
  });
}

/** One swipe up on the Feed, which turns it to the next page. */
async function swipeUp() {
  await settle(() => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -12, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -12, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
  });
}

/** The app on the Feed, with the lifecycle following the device's app state and the clock. */
async function renderApp(appState: ReturnType<typeof fakeAppState>['source']) {
  editionInEffect = loadEdition(activeEditionFiles.config);
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
      words: [
        word('w_sumyrnyi', 'сумирний'),
        word('w_lahidnyi', 'лагідний'),
        word('w_veselyi', 'веселий'),
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
  const shell: Shell = testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell}>
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
  // The lifecycle starts once the app is drawn, as the app's own Lifecycle does in an effect.
  stopLifecycle = listen(shell, {
    clock,
    appState,
    writeWidgetSnapshot: () => undefined,
    spotlight: { replace: () => Promise.resolve() },
  });
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

/** The Feed on 3 November: its header and the kicker of its Word of the Day, on its tabbed card. */
function expectTuesday() {
  expect(screen.getByText('вт, 3 листопада', hidden)).toBeTruthy();
  expect(screen.getByText('Слово дня · 3.11', hidden)).toBeTruthy();
}

describe('the Feed on a new local day', () => {
  it('shows the new date in its header and the new Word of the Day next, past midnight with the app open', async () => {
    const appState = fakeAppState();
    await renderApp(appState.source);
    expectTuesday();

    // Six minutes on: the app stayed open past midnight.
    await settle(() => jest.advanceTimersByTimeAsync(6 * 60_000));

    expect(screen.getByText('ср, 4 листопада', hidden)).toBeTruthy();
    expect(screen.queryByText('вт, 3 листопада', hidden)).toBeNull();
    // The card on screen stays (ADR 0022); the new day's Word of the Day comes after the next swipe.
    await swipeUp();
    expect(screen.getByText('Слово дня · 4.11', hidden)).toBeTruthy();
  });

  it('shows the new date in its header and the new Word of the Day next, on a return to the foreground on a new day', async () => {
    const appState = fakeAppState();
    await renderApp(appState.source);
    expectTuesday();

    // In the background timers stop: the clock moves past midnight with none firing.
    await settle(() => {
      appState.moveTo('background');
    });
    jest.setSystemTime(new Date('2026-11-04T07:30:00Z'));
    await settle(() => {
      appState.moveTo('active');
    });

    expect(screen.getByText('ср, 4 листопада', hidden)).toBeTruthy();
    expect(screen.queryByText('вт, 3 листопада', hidden)).toBeNull();
    await swipeUp();
    expect(screen.getByText('Слово дня · 4.11', hidden)).toBeTruthy();
  });
});
