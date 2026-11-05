import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
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
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import CorrectionTypeScreen from '../app/correction-type/[type]';
import CuratedCollectionScreen from '../app/curated-collection/[collectionId]';
import FeedScreen from '../app/feed';
import EntryFromSearchScreen from '../app/search/[entryId]';
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

function correction(
  id: string,
  nonStandardForm: string,
  standardEquivalents: string[],
): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType: 'surzhyk',
    standardEquivalents,
    explanation: `Пояснення до ${nonStandardForm}.`,
    examplePair: { nonStandard: 'Так кажуть.', standard: 'Так краще.' },
    categoryId: 'everyday',
    sources: [{ title: 'Словник' }],
    literaryUses: [],
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
async function open(dashboard: boolean, { previousWords = true, curatedCollections = true } = {}) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'dashboard'
        ? dashboard
        : feature === 'previousWords'
          ? previousWords && shipped.isFeatureEnabled(feature)
          : // The UA Edition ships the rail off till a content spec (ADR 0076); the test turns it on.
            feature === 'curatedCollections'
            ? curatedCollections
            : // No later question takes the Word of the Day's place in the Feed.
              feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature),
  };
  userState = await seedUserState(
    {
      onboardingFinished: '2026-09-01T09:00:00.000Z',
      wordOfTheDay: { entryId: 'w_sumyrnyi', date: '2026-10-28' },
      feedPosition: { entryId: 'w_tykhyi', date: '2026-10-28' },
      wordOfTheDayArchive: { '2026-10-27': 'w_lahidnyi' },
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
      correctionCategories: [{ id: 'everyday', displayName: 'Щоденне' }],
      corrections: [
        correction('c_shoby', 'шоби', ['щоб', 'аби']),
        correction('c_tipa', 'типу', ['ніби']),
      ],
      curatedCollections: [
        {
          id: 'cc_lahidni',
          name: 'Лагідні слова',
          description: 'Слова, що звучать м’яко.',
          publishedOn: '2026-10-20',
          entryIds: ['w_lahidnyi', 'w_tykhyi'],
        },
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
      'search/[entryId]': EntryFromSearchScreen,
      'correction-type/[type]': CorrectionTypeScreen,
      'curated-collection/[collectionId]': CuratedCollectionScreen,
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
  it('a Mood tile chooses today’s Mood, turns chosen and says its reply in a toast', async () => {
    await open(true);
    await renderApp();

    expect(screen.getByText(editionStrings.dashboard.mood.question)).toBeTruthy();
    expect(screen.getByText(editionStrings.dashboard.mood.note)).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-energetic')));

    expect(composition.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'energetic' } });
    expect(screen.getByText('Бадьоро? Тоді доженемо ціль ще до обіду.')).toBeTruthy();
    expect(
      screen.getByTestId('dashboard-mood-energetic').props['accessibilityState'],
    ).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('dashboard-mood-sleepy').props['accessibilityState']).toMatchObject({
      selected: false,
    });
  });

  it('another tile changes today’s Mood', async () => {
    await open(true);
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-energetic')));
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-sleepy')));

    expect(composition.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'sleepy' } });
    expect(screen.getByText('«Сонно» — теж слово. Але, на жаль, не рідкісне.')).toBeTruthy();
    expect(
      screen.getByTestId('dashboard-mood-energetic').props['accessibilityState'],
    ).toMatchObject({
      selected: false,
    });
  });
});

describe('«Попередні слова»', () => {
  it('lists yesterday’s Word, and a tap opens its Entry without making it Seen', async () => {
    await open(true);
    await renderApp();

    expect(screen.getByText(editionStrings.dashboard.previousWords.title)).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-previous-word-2026-10-27')));

    expect(screen.getByText('Значення слова лагідний.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });

  it('is absent with `previousWords` off', async () => {
    await open(true, { previousWords: false });
    await renderApp();

    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-previous-words')).toBeNull();
  });
});

describe('the Correction Types rail', () => {
  it('a tile counts the type\u2019s Corrections «розібрано» and opens the type\u2019s screen', async () => {
    await open(true);
    await renderApp();

    const { correctionTypes: words } = editionStrings.dashboard;
    expect(screen.getByText(words.title)).toBeTruthy();
    expect(screen.getByText('Розібрано 0 з 2')).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-correction-type-surzhyk')));

    expect(screen.getByTestId('correction-type')).toBeTruthy();
    expect(screen.getByText(words.tiles.surzhyk)).toBeTruthy();
    expect(screen.getByText('шоби')).toBeTruthy();
    expect(screen.getByText('типу')).toBeTruthy();
  });

  it('«Як правильно?» shows the standard form and the explanation, and the tile counts it', async () => {
    await open(true);
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-correction-type-surzhyk')));
    expect(screen.queryByText('щоб')).toBeNull();
    await settle(() => fireEvent.press(screen.getByTestId('correction-type-reveal-c_shoby')));

    expect(screen.getByText('щоб')).toBeTruthy();
    expect(screen.getByText(/аби/)).toBeTruthy();
    expect(screen.getByText('Пояснення до шоби.')).toBeTruthy();
    expect(screen.queryByTestId('correction-type-reveal-c_shoby')).toBeNull();
    expect(screen.getByTestId('correction-type-reveal-c_tipa')).toBeTruthy();
    expect(composition.correctionTypes.tiles).toEqual([
      { type: 'surzhyk', total: 2, workedThrough: 1 },
    ]);
  });
});

describe('the Curated Collections rail', () => {
  it('shows a published collection as «Нова» till a tap opens it', async () => {
    await open(true);
    await renderApp();

    expect(screen.getByText(editionStrings.dashboard.curatedCollectionsTitle)).toBeTruthy();
    expect(screen.getByText('Лагідні слова')).toBeTruthy();
    expect(screen.getByTestId('dashboard-curated-collection-cc_lahidni-new')).toBeTruthy();

    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    expect(screen.queryByTestId('dashboard-curated-collection-cc_lahidni-new')).toBeNull();
    expect(composition.curatedCollections.rail.map(({ state }) => state)).toEqual(['opened']);
  });

  it('a card opens the collection\u2019s screen: its name, description, «Знаю X з N» and Entries', async () => {
    await open(true);
    await renderApp();

    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    expect(screen.getByTestId('curated-collection')).toBeTruthy();
    expect(screen.getByText('Лагідні слова')).toBeTruthy();
    expect(screen.getByText('Слова, що звучать м’яко.')).toBeTruthy();
    expect(screen.getByText('Знаю 0 з 2')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-entry-w_lahidnyi')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-entry-w_tykhyi')).toBeTruthy();
    expect(screen.getByText(editionStrings.dashboard.curatedCollection.add)).toBeTruthy();
  });

  it('a Known mark counts at once and shows on its row', async () => {
    await open(true);
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    await settle(() => composition.knowledge.tap('w_tykhyi', 'known'));

    expect(screen.getByText('Знаю 1 з 2')).toBeTruthy();
    const { known } = editionStrings.knowledge;
    expect(
      within(screen.getByTestId('curated-collection-entry-w_tykhyi')).getByText(known),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('curated-collection-entry-w_lahidnyi')).queryByText(known),
    ).toBeNull();
  });

  it('a tap on a row opens its Entry without making it Seen', async () => {
    await open(true);
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-entry-w_tykhyi')));

    expect(screen.getByText('Значення слова тихий.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });

  it('«+ Додати» copies it into the Collections and shows «Додано ✓» on the screen and the card', async () => {
    await open(true);
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );
    const { add, added } = editionStrings.dashboard.curatedCollection;

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-add')));

    expect(screen.queryByText(add)).toBeNull();
    expect(screen.getByText(added)).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-back')));
    expect(screen.getByTestId('dashboard-curated-collection-cc_lahidni-added')).toBeTruthy();
    expect(composition.curatedCollections.rail.map((card) => card.added)).toEqual([true]);
  });

  it('is absent with `curatedCollections` off', async () => {
    await open(true, { curatedCollections: false });
    await renderApp();

    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-curated-collections')).toBeNull();
  });
});
