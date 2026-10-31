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
import { router, Slot } from 'expo-router';
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

/** The family app.config.ts reports for the UA Edition's Word of the Day font. */
const CALLIGRAPHIC = 'Kurale';

/** The Word font every other Lemma is set in. */
const WORD_FONT = editionTokens.fontFamilies.word;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { id: 'uk', wordOfTheDayFontFamily: 'Kurale' } } } },
}));

/** The UA Edition in effect, with `calligraphy` as the test sets it. */
let editionInEffect: Edition;

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

/** Opens the composition over two Words, with the Edition's `calligraphy` on or off. */
async function open(calligraphy: boolean) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'calligraphy' ? calligraphy : shipped.isFeatureEnabled(feature),
  };
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  const records = new Map([
    ['onboarding.finished', JSON.stringify(new Date('2026-09-01T09:00:00Z'))],
  ]);
  userState = await openUserState({ port: createMemoryUserStatePort(records) });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний')],
    }),
    edition: editionInEffect,
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
    remoteSwitches: switchedTo(editionInEffect),
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

/** The Feed's Word cards drawn, the one on screen and the next one ready, with their Lemmas. */
function feedLemmas() {
  const hidden = { includeHiddenElements: true };
  return screen.getAllByTestId('word-card', hidden).map((card) => ({
    wordOfTheDay: within(card).queryByTestId('word-of-the-day-badge', hidden) !== null,
    lemma: within(card).getByTestId('word-lemma', hidden),
  }));
}

describe('the calligraphic Lemma', () => {
  it('sets only the Lemma on the Word of the Day card in the Feed in the calligraphic font', async () => {
    await open(true);
    await renderApp();

    const cards = feedLemmas();
    expect(cards.filter(({ wordOfTheDay }) => wordOfTheDay)).toHaveLength(1);
    expect(cards.length).toBeGreaterThan(1);
    for (const { wordOfTheDay, lemma } of cards) {
      expect(lemma).toHaveStyle({ fontFamily: wordOfTheDay ? CALLIGRAPHIC : WORD_FONT });
    }
    // The rest of the card stays in the Word font.
    const [first] = screen.getAllByTestId('word-definition', { includeHiddenElements: true });
    expect(first).toHaveStyle({ fontFamily: WORD_FONT });
  });

  it('keeps what VoiceOver reads for the Lemma', async () => {
    await open(true);
    await renderApp();

    const today = feedLemmas().find(({ wordOfTheDay }) => wordOfTheDay);
    expect(today?.lemma).toHaveStyle({ fontFamily: CALLIGRAPHIC });
    expect(today?.lemma.props['accessibilityLabel']).toBe('лагідний, наголос на а');
    expect(today?.lemma.props['accessibilityRole']).toBe('header');
  });

  it('sets the Word of the Day in the Word font with `calligraphy` off', async () => {
    await open(false);
    await renderApp();

    const cards = feedLemmas();
    expect(cards.some(({ wordOfTheDay }) => wordOfTheDay)).toBe(true);
    for (const { lemma } of cards) expect(lemma).toHaveStyle({ fontFamily: WORD_FONT });
  });

  it('leaves the Entry screen of the Word of the Day in the Word font', async () => {
    await open(true);
    await renderApp();
    const today = composition.feed.cards.find(
      (card) => card.kind === 'word' && card.wordOfTheDay !== undefined,
    );

    await settle(() => {
      router.push(`/entry/${today?.entryId ?? ''}`);
    });

    expect(screen.queryByTestId('home', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('word-lemma')).toHaveStyle({ fontFamily: WORD_FONT });
  });
});
