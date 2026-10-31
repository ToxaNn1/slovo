import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  trackChanges,
  type Composition,
  type Edition,
  type Haptics,
  userStateRecords,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import MoodLayout from '../app/mood/_layout';
import EntryFromMoodScreen from '../app/mood/[entryId]';
import SavedLayout from '../app/saved/_layout';
import EntryFromArchiveScreen from '../app/saved/words-of-the-day/[entryId]';
import SearchLayout from '../app/search/_layout';
import EntryFromSearchScreen from '../app/search/[entryId]';
import { edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from './use-open-screen';
import { SettingsProvider } from '../settings/settings';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { id: 'uk', wordOfTheDayFontFamily: 'Kurale' } } } },
}));

/** The Ukrainian Edition in effect. */
let mockEdition: Edition;

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
// The Entry card's action row has its own tests.
jest.mock('../entries/entry-actions', () => ({
  EntryActions: () => null,
  useKnowledgeButtons: () => null,
}));

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

/**
 * Opens the composition over two Words for a reader who finished the
 * onboarding with the records given, on 2026-10-28 in Kyiv.
 */
async function open(records: Readonly<Record<string, unknown>>) {
  mockEdition = loadEdition(config);
  userState = await openUserState({
    port: createMemoryUserStatePort(
      new Map(Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)])),
    ),
  });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний')],
    }),
    edition: mockEdition,
    userState: userState,
    clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
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
    userState: opened(
      trackChanges({
        userState,
        clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
      }),
    ),
    composition: opened(composition),
  });

/** The app opened on `url`, with the Entry screens of Search, the mood roulette and the Words of the Day archive. */
async function renderApp(url: string) {
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
      'search/_layout': SearchLayout,
      'search/[entryId]': EntryFromSearchScreen,
      'mood/_layout': MoodLayout,
      'mood/[entryId]': EntryFromMoodScreen,
      'saved/_layout': SavedLayout,
      'saved/words-of-the-day/[entryId]': EntryFromArchiveScreen,
    },
    { initialUrl: url },
  );
  await settle();
}

const hidden = { includeHiddenElements: true };

// Spec #832 and #842: a card opened from Search, the mood roulette or the archive makes nothing Seen.
describe.each(['/search', '/mood', '/saved/words-of-the-day'])(
  'the Entry screen of %s',
  (route) => {
    it('shows the Word and leaves History empty, so nothing is Seen', async () => {
      await open({ 'onboarding.finished': '2026-09-01T09:00:00Z' });
      await renderApp(`${route}/w_sumyrnyi`);

      expect(screen.getByTestId('word-lemma', hidden)).toHaveTextContent('су́мирний', {
        exact: false,
      });
      expect(composition.history.list).toEqual([]);
      expect(await userState.list(userStateRecords.history)).toEqual(new Map());
      expect(await userState.list(userStateRecords.seen)).toEqual(new Map());
    });
  },
);
