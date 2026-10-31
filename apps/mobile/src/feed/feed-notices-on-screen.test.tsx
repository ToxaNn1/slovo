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
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import HomeScreen from '../app/index';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';
import { SettingsProvider } from '../settings/settings';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { id: 'uk', wordOfTheDayFontFamily: 'Kurale' } } } },
}));

/** The Ukrainian Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition: Edition = loadEdition(config);

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));
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
    edition: shippedEdition,
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
    remoteSwitches: switchedTo(shippedEdition),
    composition: opened(composition),
  });

/** The app on the Feed, with the Entry screen a link opens. */
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
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
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

describe('the Feed Notices on the Feed', () => {
  it('shows the first-week card of the first Active Day after the onboarding', async () => {
    await open({
      'onboarding.finished': '2026-10-28T08:00:00Z',
      'firstWeek.from': '2026-10-28',
    });
    await renderApp();

    const card = screen.getByTestId('feed-notice-firstWeek', hidden);
    const [day1] = editionStrings.feedNotices.firstWeek.days;
    expect(within(card).getByText(day1.title, hidden)).toBeTruthy();
  });

  it('shows no Feed Notice to a reader past the first week with no other notice due', async () => {
    await open({ 'onboarding.finished': '2026-09-01T09:00:00Z' });
    await renderApp();

    expect(screen.getAllByTestId('word-card', hidden).length).toBeGreaterThan(0);
    expect(screen.queryByTestId(/^feed-notice-/, hidden)).toBeNull();
  });
});
