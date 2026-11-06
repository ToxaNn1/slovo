import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition, type Haptics } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import CorrectionTypeScreen from '../app/correction-type/[type]';
import CuratedCollectionScreen from '../app/curated-collection/[collectionId]';
import FeedScreen from '../app/feed';
import EntryFromSearchScreen from '../app/search/[entryId]';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { Onboarding } from '../onboarding/onboarding';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;
const { onboarding: steps } = editionStrings;

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

let composition: Composition;

/**
 * The app of a new reader on 2026-10-28 in Kyiv, with the Onboarding over the
 * home as the root layout draws it. Today's Word of the Day is сумирний,
 * yesterday's лагідний, the gestures hint has been shown, and the Edition turns the Curated Collections rail on,
 * which the UA Edition ships off till a content spec (ADR 0076).
 */
async function renderApp() {
  const shipped = loadEdition(config);
  const editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature: Parameters<typeof shipped.isFeatureEnabled>[0]) =>
      feature === 'curatedCollections' ||
      // No later question takes the Word of the Day's place in the Feed.
      (feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature)),
  };
  const userState = await seedUserState(
    {
      wordOfTheDay: { entryId: 'w_sumyrnyi', date: '2026-10-28' },
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
          entryIds: ['w_lahidnyi', 'w_tykhyi'],
        },
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
  const shell = testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });
  const app = renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <SettingsProvider>
                    <Slot />
                    <Onboarding />
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
  await app;
  await settle();
  return { pathname: () => app.getPathname() };
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

const press = (testID: string) => settle(() => fireEvent.press(screen.getByTestId(testID)));

/** Goes back to the Dashboard; the stack reports the transition's end, which lets the next tap open a screen. */
async function back(testID: string) {
  await press(testID);
  screenSettled();
}

// Spec #1564, ticket #1575: one walk over every block of the Dashboard (ADR 0076).
describe('the whole Dashboard', () => {
  it('walks onboarding → hero → Mood → «Попередні слова» → Correction Type → Curated Collection → «До картки →» Feed → wordmark → Dashboard', async () => {
    const app = await renderApp();

    // Onboarding, the quickest way through: it lands on the Dashboard.
    expect(screen.getByText(steps.welcome.title)).toBeTruthy();
    await press('onboarding-start');
    await press('onboarding-next');
    await press('onboarding-next');
    await press('onboarding-answer-good');
    await press('onboarding-later');
    await press('onboarding-done');
    await press('onboarding-time-20:30');
    expect(composition.onboarding.state.finishedAt).toEqual(clock.now());
    expect(screen.getByTestId('dashboard')).toBeTruthy();

    // The hero: «Розкрити» reveals the Word of the Day in place and makes it Seen.
    expect(screen.queryByText('Значення слова сумирний.')).toBeNull();
    await settle(() => fireEvent.press(screen.getByText(editionStrings.wordOfTheDay.reveal)));
    expect(screen.getByText('Значення слова сумирний.')).toBeTruthy();
    expect(composition.history.list.map(({ entryId }) => entryId)).toEqual(['w_sumyrnyi']);

    // A Mood tile chooses today's Mood, and a toast says its reply.
    await press('dashboard-mood-energetic');
    expect(composition.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'energetic' } });
    expect(screen.getByText('Бадьоро? Тоді доженемо ціль ще до обіду.')).toBeTruthy();

    // «Попередні слова»: yesterday's Word opens its Entry, making nothing more Seen.
    await press('dashboard-previous-word-2026-10-27');
    expect(screen.getByText('Значення слова лагідний.')).toBeTruthy();
    expect(composition.history.list.map(({ entryId }) => entryId)).toEqual(['w_sumyrnyi']);
    await back('entry-screen-back');
    expect(screen.getByTestId('dashboard')).toBeTruthy();

    // A Correction Type: its screen lists the type's Corrections, and «Як правильно?» counts one.
    expect(composition.correctionTypes.tiles).toEqual([
      { type: 'surzhyk', total: 2, workedThrough: 0 },
    ]);
    await press('dashboard-correction-type-surzhyk');
    expect(screen.getByTestId('correction-type')).toBeTruthy();
    await press('correction-type-reveal-c_shoby');
    expect(screen.getByText('Пояснення до шоби.')).toBeTruthy();
    await back('correction-type-back');
    expect(composition.correctionTypes.tiles).toEqual([
      { type: 'surzhyk', total: 2, workedThrough: 1 },
    ]);

    // A Curated Collection: «Нова» goes, and its screen shows its Entries and «Знаю X з N».
    expect(screen.getByTestId('dashboard-curated-collection-cc_lahidni-new')).toBeTruthy();
    await press('dashboard-curated-collection-cc_lahidni');
    expect(screen.getByTestId('curated-collection')).toBeTruthy();
    expect(screen.getByText('Знаю 0 з 2')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-entry-w_tykhyi')).toBeTruthy();
    await back('curated-collection-back');
    expect(screen.queryByTestId('dashboard-curated-collection-cc_lahidni-new')).toBeNull();

    // «До картки →» opens the Feed on the Word of the Day card.
    await settle(() => fireEvent.press(screen.getByText(editionStrings.dashboard.toCard)));
    await fireEvent(screen.getByTestId('feed'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
    await settle();
    await waitFor(() => {
      expect(composition.feed.cards[composition.feed.position]?.entryId).toBe('w_sumyrnyi');
    });

    // The wordmark of the Feed's header leads back to the Dashboard (ADR 0079).
    screenSettled();
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: editionStrings.dashboard.open })),
    );
    expect(app.pathname()).toBe('/');
    // The whole app, walked screen by screen: longer than one screen's test on a busy machine.
  }, 20_000);
});
