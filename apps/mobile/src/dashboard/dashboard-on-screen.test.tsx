import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type Edition,
  type Haptics,
  type TrackedUserState,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import FeedScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

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

let editionInEffect: Edition;
let userState: TrackedUserState;
let composition: Composition;

/**
 * Opens the composition over three Words, with `dashboard` on or off. Today's
 * Word of the Day is сумирний, and the reader was on a later card of the Feed.
 */
async function open(dashboard: boolean) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'dashboard'
        ? dashboard
        : // No later question takes the Word of the Day's place in the Feed.
          feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature),
  };
  userState = await seedUserState(
    {
      onboardingFinished: '2026-09-01T09:00:00.000Z',
      wordOfTheDay: { entryId: 'w_sumyrnyi', date: '2026-10-28' },
      feedPosition: { entryId: 'w_tykhyi', date: '2026-10-28' },
    },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: [
        word('w_sumyrnyi', 'сумирний'),
        word('w_lahidnyi', 'лагідний'),
        word('w_tykhyi', 'тихий'),
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
}

beforeEach(() => {
  // The routes read the device's clock: the same morning as the composition's.
  jest.useFakeTimers({ now: clock.now() });
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

const shell = () =>
  testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });

/** The app on the home route, with the Feed route the Dashboard opens. */
async function renderApp() {
  await renderRouter(
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
      feed: FeedScreen,
    },
    { initialUrl: '/' },
  );
  await settle();
}

/** Lays the Feed's pager out, which it needs to show its pages. */
async function layOutFeed() {
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

describe('the home', () => {
  it('shows the Dashboard with the Word of the Day hero unrevealed', async () => {
    await open(true);
    await renderApp();

    expect(screen.getByTestId('dashboard')).toBeTruthy();
    expect(screen.queryByTestId('feed')).toBeNull();
    expect(screen.getByText(editionStrings.wordOfTheDay.reveal)).toBeTruthy();
    expect(screen.queryByText('Значення слова сумирний.')).toBeNull();
  });

  it('shows the Feed with `dashboard` off', async () => {
    await open(false);
    await renderApp();

    expect(screen.queryByTestId('dashboard')).toBeNull();
    expect(screen.getByTestId('feed')).toBeTruthy();
  });
});

describe('the Word of the Day hero', () => {
  it('«Розкрити» reveals the Word in place and makes it Seen', async () => {
    await open(true);
    await renderApp();

    await settle(() => fireEvent.press(screen.getByText(editionStrings.wordOfTheDay.reveal)));

    expect(screen.getByTestId('dashboard')).toBeTruthy();
    expect(screen.getByText('Значення слова сумирний.')).toBeTruthy();
    expect(screen.queryByText(editionStrings.wordOfTheDay.reveal)).toBeNull();
    expect(composition.history.list.map(({ entryId }) => entryId)).toContain('w_sumyrnyi');
  });

  it('«До картки →» opens the Feed on the Word of the Day card', async () => {
    await open(true);
    await renderApp();

    await settle(() => fireEvent.press(screen.getByText(editionStrings.dashboard.toCard)));
    await layOutFeed();

    await waitFor(() => {
      expect(composition.feed.cards[composition.feed.position]?.entryId).toBe('w_sumyrnyi');
    });
  });
});

describe('the Mood check-in', () => {
  it('a Mood chip folds the block to «Сьогодні: …» with its reply', async () => {
    await open(true);
    await renderApp();

    expect(screen.getByText(editionStrings.dashboard.mood.question)).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-energetic')));

    expect(screen.getByText('Сьогодні: ⚡ Бадьорий')).toBeTruthy();
    expect(screen.getByText('Тримай темп!')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-mood-energetic')).toBeNull();
    expect(screen.queryByText(editionStrings.dashboard.mood.question)).toBeNull();
  });

  it('«змінити» opens the chips again and changes today’s Mood', async () => {
    await open(true);
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-energetic')));
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-change')));
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-calm')));

    expect(screen.getByText('Сьогодні: 😌 Спокійний')).toBeTruthy();
  });

  it('«Не сьогодні» hides the block', async () => {
    await open(true);
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-skip')));

    expect(screen.queryByTestId('dashboard-mood')).toBeNull();
    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
  });
});
