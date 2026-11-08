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
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

/** The UA Edition with the side swipes marking an Entry as `swipeMarks` says. */
function editionWith(swipeMarks: boolean): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, knowledge: true, swipeMarks },
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

/** Opens the composition over two Words. */
async function open(swipeMarks: boolean) {
  editionInEffect = editionWith(swipeMarks);
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  userState = await seedUserState({ onboardingFinished: '2026-09-01T09:00:00.000Z' }, { clock });
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

describe('the gestures hint sheet on the Feed', () => {
  it('shows «ГОРТАЙ ПАЛЬЦЕМ» with its three rows on the first launch with swipeMarks on', async () => {
    await open(true);
    await renderApp();
    await settle();
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    // The board's texts in «ти» (ADR 0092).
    expect(screen.getByText('ГОРТАЙ ПАЛЬЦЕМ')).toBeOnTheScreen();
    expect(screen.getByText('Вправо — знаю')).toBeOnTheScreen();
    expect(screen.getByText('Вліво — не знаю')).toBeOnTheScreen();
    expect(screen.getByText('Вгору — наступне слово')).toBeOnTheScreen();
    expect(screen.getByText('Нове слово — коли захочеш.')).toBeOnTheScreen();
  });

  it('goes on «ЗРОЗУМІЛО» and stays gone after a restart', async () => {
    await open(true);
    await renderApp();
    await settle(() => fireEvent.press(screen.getByTestId('gestures-hint-dismiss')));
    // The sheet slides away.
    await waitFor(() => {
      expect(screen.queryByTestId('gestures-hint')).toBeNull();
    });
    await screen.unmount();
    screenSettled();
    await reopen();
    await renderApp();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint')).toBeNull();
  });

  it('is shown once: not on the next launch even when it was not dismissed', async () => {
    await open(true);
    await renderApp();
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    await screen.unmount();
    screenSettled();
    await reopen();
    await renderApp();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint')).toBeNull();
  });

  it('shows no hint at all with swipeMarks off', async () => {
    await open(false);
    await renderApp();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint')).toBeNull();
    expect(screen.queryByText('ГОРТАЙ ПАЛЬЦЕМ')).toBeNull();
  });
});
