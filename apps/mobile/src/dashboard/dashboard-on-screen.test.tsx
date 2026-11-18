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
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import CategoriesScreen from '../app/categories';
import CategoryScreen from '../app/category/[categoryId]';
import CorrectionCategoriesScreen from '../app/correction-categories';
import CorrectionCategoryScreen from '../app/correction-category/[categoryId]';
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
  standardEquivalents: Correction['standardEquivalents'],
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
 * Opens the composition over three Words. Today's
 * Word of the Day is сумирний, and the reader was on a later card of the Feed.
 */
async function open({
  previousWords = true,
  curatedCollections = true,
  categoryScreens = true,
  correctionCategoryScreens = true,
  correctionTypeGrid = true,
} = {}) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'categoryScreens'
        ? categoryScreens
        : feature === 'correctionCategoryScreens'
          ? correctionCategoryScreens
          : feature === 'correctionTypeGrid'
            ? correctionTypeGrid
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
      // The gestures hint was shown on an earlier launch: its finger demo loops for as long as
      // the sheet is open, which settling every timer would never finish. It has its own test.
      gesturesHintShown: true,
    },
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
        word('w_tykhyi', 'тихий'),
      ],
      correctionCategories: [
        { id: 'everyday', displayName: 'Щоденне', description: 'Щоденне.', tone: 'loud' },
      ],
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
          retired: false,
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
      feed: FeedScreen,
      'search/[entryId]': EntryFromSearchScreen,
      'correction-type/[type]': CorrectionTypeScreen,
      'curated-collection/[collectionId]': CuratedCollectionScreen,
      categories: CategoriesScreen,
      'category/[categoryId]': CategoryScreen,
      'correction-categories': CorrectionCategoriesScreen,
      'correction-category/[categoryId]': CorrectionCategoryScreen,
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
    await open();
    await renderApp();

    expect(screen.getByTestId('dashboard')).toBeTruthy();
    expect(screen.queryByTestId('feed')).toBeNull();
    expect(screen.getByText(editionStrings.dashboard.reveal)).toBeTruthy();
    expect(screen.queryByText('Значення слова сумирний.')).toBeNull();
  });

  it('dates its header by the Feed\u2019s day, as the Feed header does', async () => {
    await open();
    // The device's clock a day on from the composition's: the header follows the Feed.
    jest.setSystemTime(new Date('2026-10-29T09:00:00Z'));
    await renderApp();

    expect(screen.getByText('ср, 28 жовтня')).toBeTruthy();
    expect(screen.queryByText('чт, 29 жовтня')).toBeNull();
  });
});

describe('the Word of the Day hero', () => {
  it('«Розкрити» reveals the Word in place and makes it Seen', async () => {
    await open();
    await renderApp();

    await settle(() => fireEvent.press(screen.getByText(editionStrings.dashboard.reveal)));

    expect(screen.getByTestId('dashboard')).toBeTruthy();
    expect(screen.getByText('Значення слова сумирний.')).toBeTruthy();
    expect(screen.queryByText(editionStrings.dashboard.reveal)).toBeNull();
    expect(composition.history.list.map(({ entryId }) => entryId)).toContain('w_sumyrnyi');
  });

  it('«До картки →», once revealed, opens the Feed on the Word of the Day card', async () => {
    await open();
    await renderApp();

    expect(screen.queryByText(editionStrings.dashboard.toCard)).toBeNull();
    await settle(() => fireEvent.press(screen.getByText(editionStrings.dashboard.reveal)));
    await settle(() => fireEvent.press(screen.getByText(editionStrings.dashboard.toCard)));
    await layOutFeed();

    await waitFor(() => {
      expect(composition.feed.cards[composition.feed.position]?.entryId).toBe('w_sumyrnyi');
    });
  });
});

describe('the Mood check-in', () => {
  it('a Mood tile chooses today’s Mood, turns chosen and says its reply in a toast', async () => {
    await open();
    await renderApp();

    expect(screen.getByText(editionStrings.dashboard.mood.question)).toBeTruthy();
    expect(screen.getByText(editionStrings.dashboard.mood.note)).toBeTruthy();
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-energetic')));

    expect(composition.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'energetic' } });
    expect(
      screen.getByText('Бадьоро? Тоді слова сьогодні рідкісніші, а Виправлень більше.'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('dashboard-mood-energetic').props['accessibilityState'],
    ).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('dashboard-mood-joyful').props['accessibilityState']).toMatchObject({
      selected: false,
    });
  });

  it('another tile changes today’s Mood', async () => {
    await open();
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-energetic')));
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-mood-joyful')));

    expect(composition.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'joyful' } });
    expect(screen.getByText('Радісно? Ловімо слово, яким можна поділитися з другом.')).toBeTruthy();
    expect(
      screen.getByTestId('dashboard-mood-energetic').props['accessibilityState'],
    ).toMatchObject({
      selected: false,
    });
  });
});

describe('«Попередні слова»', () => {
  it('lists yesterday’s Word, and a tap opens its Entry without making it Seen', async () => {
    await open();
    await renderApp();

    expect(screen.getByText(editionStrings.dashboard.previousWords.title)).toBeTruthy();
    const row = screen.getByTestId('dashboard-previous-word-2026-10-27');
    expect(within(row).getByText('27\nжовт.')).toBeTruthy();
    expect(within(row).getByText('Значення слова лагідний.')).toBeTruthy();
    await settle(() => fireEvent.press(row));

    expect(screen.getByText('Значення слова лагідний.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });

  it('is absent with `previousWords` off', async () => {
    await open({ previousWords: false });
    await renderApp();

    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-previous-words')).toBeNull();
  });
});

describe('the Correction Types rail', () => {
  it('the title counts the tiles, a tile names its type and opens the type\u2019s screen', async () => {
    await open();
    await renderApp();

    const { correctionTypes: words } = editionStrings.dashboard;
    const title = screen.getByTestId('dashboard-correction-types-title');
    expect(within(title).getByText(words.title)).toBeTruthy();
    expect(within(title).getByText('1')).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-correction-type-surzhyk')).getByText(
        words.tiles.surzhyk,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Розібрано/)).toBeNull();
    await settle(() => fireEvent.press(screen.getByTestId('dashboard-correction-type-surzhyk')));

    expect(screen.getByTestId('correction-type')).toBeTruthy();
    expect(screen.getByText(words.tiles.surzhyk)).toBeTruthy();
    expect(screen.getByText('шоби')).toBeTruthy();
    expect(screen.getByText('типу')).toBeTruthy();
  });

  it('its header opens the grid of the rail\u2019s types alone, with no Categories under them (owner 15.11)', async () => {
    await open();
    await renderApp();

    const { dashboard } = editionStrings;
    const header = screen.getByRole('button', { name: `${dashboard.correctionTypes.title}, 1` });
    await settle(() => fireEvent.press(header));

    expect(
      screen.getByRole('header', { name: `${dashboard.correctionTypes.title}, 1` }),
    ).toBeTruthy();
    expect(screen.getByTestId('correction-types-surzhyk-name')).toHaveTextContent(
      dashboard.correctionTypes.tiles.surzhyk,
    );
    expect(screen.queryByRole('header', { name: `${dashboard.categories.title}, 1` })).toBeNull();
    expect(screen.queryByTestId('correction-categories-everyday')).toBeNull();
  });

  it('a type\u2019s tile in the grid its header opens opens the type\u2019s screen', async () => {
    await open();
    await renderApp();

    const { correctionTypes: words } = editionStrings.dashboard;
    await settle(() => fireEvent.press(screen.getByRole('button', { name: `${words.title}, 1` })));
    screenSettled();
    await settle(() => fireEvent.press(screen.getByTestId('correction-types-surzhyk')));

    expect(screen.getByTestId('correction-type')).toBeTruthy();
    expect(screen.getByText('шоби')).toBeTruthy();
  });

  it('with `correctionTypeGrid` off its header opens k2 alone, titled «Виправлення»', async () => {
    await open({ correctionTypeGrid: false });
    await renderApp();

    const { correctionTypes: words, correctionCategories } = editionStrings.dashboard;
    await settle(() => fireEvent.press(screen.getByRole('button', { name: `${words.title}, 1` })));

    expect(screen.queryByTestId('correction-types')).toBeNull();
    expect(screen.getByRole('header', { name: `${correctionCategories.title}, 1` })).toBeTruthy();
    expect(screen.getByTestId('correction-categories-everyday-name')).toHaveTextContent('Щоденне');
  });

  it('its header is a plain title with `correctionCategoryScreens` off', async () => {
    await open({ correctionCategoryScreens: false });
    await renderApp();

    const title = screen.getByTestId('dashboard-correction-types-title');
    expect(within(title).getByText(editionStrings.dashboard.correctionTypes.title)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Виправлення/ })).toBeNull();
  });

  it('«Відповідь» shows the standard form and the explanation, and counts it «розібрано»', async () => {
    await open();
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-correction-type-surzhyk')));
    expect(screen.queryByText('щоб')).toBeNull();
    expect(screen.getByTestId('correction-type-hero-progress')).toHaveTextContent(
      'Розібрано 0 з 2',
    );
    await settle(() => fireEvent.press(screen.getByTestId('correction-type-reveal-c_shoby')));

    expect(screen.getByTestId('correction-type-hero-progress')).toHaveTextContent(
      'Розібрано 1 з 2',
    );

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

describe('the Categories rail', () => {
  it('reads «Категорії» with their number, a tile with a Category’s name and no count', async () => {
    await open();
    await renderApp();

    const title = screen.getByTestId('dashboard-categories-title');
    expect(within(title).getByText('Категорії')).toBeTruthy();
    expect(within(title).getByText('1')).toBeTruthy();
    expect(screen.getByLabelText('Категорії, 1')).toBeTruthy();
    const tile = screen.getByTestId('dashboard-category-emotions-character');
    expect(within(tile).getByText('Емоції')).toBeTruthy();
    expect(within(tile).queryByText('1')).toBeNull();
  });

  it('is absent with `categoryScreens` off, the other blocks as today', async () => {
    await open({ categoryScreens: false });
    await renderApp();

    expect(screen.queryByTestId('dashboard-categories')).toBeNull();
    expect(screen.queryByText('Категорії')).toBeNull();
    expect(screen.getByTestId('dashboard-curated-collections-title')).toBeTruthy();
  });

  it('its header opens k1, the grid of every Category, and a tile there opens the Category', async () => {
    await open();
    await renderApp();

    await settle(() => fireEvent.press(screen.getByTestId('dashboard-categories-title')));

    expect(screen.getByRole('header', { name: 'Категорії, 1' })).toBeTruthy();
    expect(screen.getByTestId('categories-emotions-character-name')).toHaveTextContent('Емоції');

    // The Stack's transition end settles the opener in the app.
    screenSettled();
    await settle(() => fireEvent.press(screen.getByTestId('categories-emotions-character')));

    expect(screen.getByTestId('category')).toHaveTextContent(/Емоції/);
    expect(screen.getByText('Емоції.')).toBeTruthy();
  });

  it('a tile on the rail opens its Category’s screen', async () => {
    await open();
    await renderApp();

    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-category-emotions-character')),
    );

    expect(screen.getByTestId('category')).toHaveTextContent(/Емоції/);
  });
});

describe('the Curated Collections rail', () => {
  it('reads «SLOVO пропонує» with the count of collections, a tile with its name, and a tap opens it', async () => {
    await open();
    await renderApp();

    const title = screen.getByTestId('dashboard-curated-collections-title');
    expect(within(title).getByText('SLOVO пропонує')).toBeTruthy();
    expect(within(title).getByText('1')).toBeTruthy();
    const tile = screen.getByTestId('dashboard-curated-collection-cc_lahidni');
    expect(within(tile).getByText('Лагідні слова')).toBeTruthy();

    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    expect(composition.curatedCollections.rail.map(({ state }) => state)).toEqual(['opened']);
  });

  it('shows a tile\u2019s count of Entries and «Нова» till a tap opens it', async () => {
    await open();
    await renderApp();

    const tile = screen.getByTestId('dashboard-curated-collection-cc_lahidni');
    expect(within(tile).getByText('2 слова')).toBeTruthy();
    expect(screen.getByTestId('dashboard-curated-collection-cc_lahidni-mark')).toHaveTextContent(
      'Нова',
    );

    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    expect(screen.queryByTestId('dashboard-curated-collection-cc_lahidni-mark')).toBeNull();
  });

  it('a card opens the collection\u2019s screen: its name, description, «Знаю X з N» and Entries', async () => {
    await open();
    await renderApp();

    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    expect(screen.getByTestId('curated-collection')).toBeTruthy();
    expect(screen.getByText('ДОБІРКА · 2 слова')).toBeTruthy();
    expect(screen.getByText('Лагідні слова')).toBeTruthy();
    expect(screen.getByText('Слова, що звучать м’яко.')).toBeTruthy();
    expect(screen.getByText('Знаю 0 з 2')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-entry-w_lahidnyi')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-entry-w_tykhyi')).toBeTruthy();
    expect(
      screen.getByRole('togglebutton', { name: 'ДОДАТИ СОБІ' }).props['accessibilityState'],
    ).toMatchObject({ checked: false });
  });

  it('a Known mark counts at once and shows on its row', async () => {
    await open();
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    await settle(() => composition.knowledge.tap('w_tykhyi', 'known'));

    expect(screen.getByText('Знаю 1 з 2')).toBeTruthy();
    const { knownStamp: known } = editionStrings.dashboard.category;
    expect(
      within(screen.getByTestId('curated-collection-entry-w_tykhyi')).getByText(known),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('curated-collection-entry-w_lahidnyi')).queryByText(known),
    ).toBeNull();
  });

  it('shows the error with a retry when its read fails, and the retry reads it again', async () => {
    await open();
    await renderApp();
    jest
      .spyOn(composition.curatedCollections, 'screen')
      .mockRejectedValueOnce(new Error('The pack is busy'));
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    const error = screen.getByTestId('curated-collection-error');
    expect(within(error).getByText(editionStrings.loadFailed.title)).toBeTruthy();

    await settle(() => fireEvent.press(within(error).getByText(editionStrings.loadFailed.retry)));
    expect(screen.queryByTestId('curated-collection-error')).toBeNull();
    expect(screen.getByTestId('curated-collection-entry-w_tykhyi')).toBeTruthy();
  });

  it('a tap on a row opens its Entry without making it Seen', async () => {
    await open();
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-entry-w_tykhyi')));

    expect(screen.getByText('Значення слова тихий.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });

  it('«ДОДАТИ СОБІ» copies it into the Collections and turns to «У МІКСІ» with the tick', async () => {
    await open();
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'ДОДАТИ СОБІ' })));

    expect(screen.queryByText('ДОДАТИ СОБІ')).toBeNull();
    expect(
      screen.getByRole('togglebutton', { name: 'У МІКСІ' }).props['accessibilityState'],
    ).toMatchObject({ checked: true });
    expect(screen.getByTestId('curated-collection-add-icon')).toBeTruthy();
    expect(composition.curatedCollections.rail.map((card) => card.added)).toEqual([true]);
  });

  it('shows the added mark on the card once copied', async () => {
    await open();
    await renderApp();
    await settle(() =>
      fireEvent.press(screen.getByTestId('dashboard-curated-collection-cc_lahidni')),
    );

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-add')));
    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-back')));

    expect(screen.getByTestId('dashboard-curated-collection-cc_lahidni-mark')).toHaveTextContent(
      editionStrings.dashboard.curatedCollection.added,
    );
  });

  it('is absent with `curatedCollections` off', async () => {
    await open({ curatedCollections: false });
    await renderApp();

    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-curated-collections')).toBeNull();
  });
});
