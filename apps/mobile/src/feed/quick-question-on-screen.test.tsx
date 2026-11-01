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
import { createMemoryContentPort, seedUserState, type UserStateFacts } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Kurale' } } } },
}));

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition: Edition = loadEdition(config);

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

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
 * Opens the composition over 14 Words for a reader who finished the
 * onboarding with the facts given, on 2026-10-28 in Kyiv.
 */
async function open(facts: UserStateFacts) {
  userState = await seedUserState(facts, { clock });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: Array.from({ length: 14 }, (_, index) =>
        word(`w_${String(index)}`, `слово${String(index)}`),
      ),
    }),
    edition: shippedEdition,
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

// Spec #1358, ticket #1374: the Quick Question in its own Feed slot.
describe('the Quick Question on the Feed', () => {
  it('asks its Round and keeps the option the reader picked', async () => {
    await open({ onboardingFinished: '2026-09-01T09:00:00Z', mixQuickQuestion: 6 });
    while (!composition.feed.cards.some((card) => card.kind === 'quick-question')) {
      if ((await composition.feed.next()) === undefined) throw new Error('No Quick Question');
    }
    const position = composition.feed.cards.findIndex((card) => card.kind === 'quick-question');
    const asked = composition.feed.cards[position];
    if (asked?.kind !== 'quick-question') throw new Error('No Quick Question');
    // The reader is on the Quick Question when the Feed is drawn.
    await composition.feed.show(position);
    await renderApp();

    const card = screen.getByTestId('quick-question', hidden);
    expect(within(card).getByText(editionStrings.feed.quickQuestion, hidden)).toBeTruthy();
    expect(within(card).getAllByText(asked.round.prompt, hidden).length).toBeGreaterThan(0);
    await settle(() =>
      fireEvent.press(
        within(card).getByTestId(`game-option-${String(asked.round.correct)}`, hidden),
      ),
    );

    expect(composition.feed.cards[position]).toMatchObject({ answered: asked.round.correct });
    expect(
      within(screen.getByTestId('quick-question', hidden)).getByTestId('game-option-0', hidden),
    ).toBeDisabled();
  });
});
