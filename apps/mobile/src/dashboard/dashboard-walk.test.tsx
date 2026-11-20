import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { Slot, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import HomeScreen from '../app/index';
import CorrectionTypeScreen from '../app/correction-type/[type]';
import CuratedCollectionScreen from '../app/curated-collection/[collectionId]';
import CuratedCollectionsScreen from '../app/curated-collections';
import FeedScreen from '../app/feed';
import EntryFromSearchScreen from '../app/search/[entryId]';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { Onboarding } from '../onboarding/onboarding';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { screenSettled } from '../use-open-screen';

const { config } = activeEditionFiles;
const { onboarding: steps } = editionStrings;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

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

let composition: Composition;

/**
 * The app of a new reader on 2026-10-28 in Kyiv, with the Onboarding over the
 * home as the root layout draws it. Today's Word of the Day is сумирний,
 * yesterday's лагідний, the gestures hint has been shown, and the Edition turns the Curated Collections rail on,
 * which the UA Edition ships off till a content spec (ADR 0076).
 */
async function openApp(feedScreen: () => ReactElement = FeedScreen) {
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
        { ...word('w_retired', 'старий'), retired: true },
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
        {
          id: 'cc_mishani',
          name: 'Мішанина',
          description: 'Слова й Виправлення впереміш.',
          publishedOn: '2026-10-25',
          retired: false,
          entryIds: ['c_tipa', 'w_tykhyi', 'w_retired', 'w_sumyrnyi'],
        },
        {
          id: 'cc_zavtra',
          name: 'Завтрашня',
          description: 'Ще не вийшла.',
          publishedOn: '2026-10-29',
          retired: false,
          entryIds: ['w_tykhyi'],
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
  const app = await renderApp(
    {
      _layout: () => (
        <>
          <Slot />
          <Onboarding />
        </>
      ),
      index: HomeScreen,
      feed: feedScreen,
      'search/[entryId]': EntryFromSearchScreen,
      'correction-type/[type]': CorrectionTypeScreen,
      'curated-collection/[collectionId]': CuratedCollectionScreen,
      'curated-collections': CuratedCollectionsScreen,
    },
    { shell },
  );
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
  it('walks onboarding → hero → Mood → «Попередні слова» → Correction Type → Curated Collection → their grid → «До картки →» Feed → wordmark → Dashboard', async () => {
    const app = await openApp();

    // Onboarding, the quickest way through: it lands on the Dashboard.
    expect(screen.getByText(steps.welcome.title)).toBeTruthy();
    await press('onboarding-start');
    await press('onboarding-next');
    await press('onboarding-next');
    await press('onboarding-answer-good');
    await press('onboarding-later');
    await press('onboarding-done');
    await press('onboarding-time-20:30');
    expect(composition.onboarding.state).toEqual({ status: 'finished', finishedAt: clock.now() });
    expect(screen.getByTestId('dashboard')).toBeTruthy();

    // The hero: «Беру!» took the first Word, so it is revealed and Seen already (ticket #2062).
    expect(screen.queryByText(editionStrings.dashboard.reveal)).toBeNull();
    expect(screen.getByText('Значення слова сумирний.')).toBeTruthy();
    expect(composition.history.list.map(({ entryId }) => entryId)).toEqual(['w_sumyrnyi']);

    // A Mood tile chooses today's Mood, and a toast says its reply.
    await press('dashboard-mood-energetic');
    expect(composition.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'energetic' } });
    expect(
      screen.getByText('Бадьоро? Тоді слова сьогодні рідкісніші, а Виправлень більше.'),
    ).toBeTruthy();

    // «Попередні слова»: yesterday's Word opens its Entry, making nothing more Seen.
    await press('dashboard-previous-word-2026-10-27');
    expect(screen.getByText('Значення слова лагідний.')).toBeTruthy();
    expect(composition.history.list.map(({ entryId }) => entryId)).toEqual(['w_sumyrnyi']);
    await back('entry-screen-back');
    expect(screen.getByTestId('dashboard')).toBeTruthy();

    // A Correction Type: its screen lists the type's Corrections, and «Відповідь» counts one.
    expect(composition.correctionTypes.tiles).toEqual([
      { type: 'surzhyk', total: 2, workedThrough: 0 },
    ]);
    await press('dashboard-correction-type-surzhyk');
    expect(screen.getByTestId('correction-type')).toBeTruthy();
    await press('correction-type-reveal-c_shoby');
    expect(screen.getByText('Пояснення до шоби.')).toBeTruthy();
    // Every way back of these screens is the neutral «Назад»: they open from more than one place.
    expect(screen.getByTestId('correction-type-back')).toHaveProp('accessibilityLabel', 'Назад');
    await back('correction-type-back');
    expect(composition.correctionTypes.tiles).toEqual([
      { type: 'surzhyk', total: 2, workedThrough: 1 },
    ]);

    // A Curated Collection: its screen shows its Entries and «Знаю X з N».
    expect(screen.getByTestId('dashboard-curated-collection-cc_lahidni-mark')).toHaveTextContent(
      'Нова',
    );
    await press('dashboard-curated-collection-cc_lahidni');
    expect(screen.getByTestId('curated-collection')).toBeTruthy();
    expect(screen.getByText('Знаю 0 з 2')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-entry-w_tykhyi')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-back')).toHaveProp('accessibilityLabel', 'Назад');
    await back('curated-collection-back');
    expect(screen.queryByTestId('dashboard-curated-collection-cc_lahidni-mark')).toBeNull();

    // The rail header opens the grid of every collection published by today, a future one absent.
    await press('dashboard-curated-collections-title');
    screenSettled();
    expect(screen.getByTestId('curated-collections-title')).toHaveProp(
      'accessibilityLabel',
      'Добірки, 2',
    );
    expect(screen.queryByTestId('curated-collections-cc_zavtra')).toBeNull();
    expect(screen.getByTestId('curated-collections-cc_mishani-mark')).toHaveTextContent('Нова');
    // Its tile opens the collection's screen: «ДОБІРКА», «Знаю X з N», the copy, its Entries of
    // every kind in order without the Retired one, and no Mix button.
    await press('curated-collections-cc_mishani');
    expect(screen.getByTestId('curated-collection-hero-kicker')).toHaveTextContent(
      'ДОБІРКА · 3 слова',
    );
    expect(screen.getByText('Знаю 0 з 3')).toBeTruthy();
    expect(screen.getByTestId('curated-collection-add')).toHaveTextContent('ДОДАТИ СОБІ');
    expect(screen.queryByTestId('category-mix')).toBeNull();
    expect(
      screen
        .getAllByTestId(/^curated-collection-entry-[^-]+$/)
        .map(({ props }) => String(props['testID'])),
    ).toEqual([
      'curated-collection-entry-c_tipa',
      'curated-collection-entry-w_tykhyi',
      'curated-collection-entry-w_sumyrnyi',
    ]);
    await back('curated-collection-back');
    expect(screen.queryByTestId('curated-collections-cc_mishani-mark')).toBeNull();
    await back('curated-collections-back');

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

/** A Feed that never has today's Word of the Day card, so it never lands the ask. */
function FeedWithoutTheCard() {
  const router = useRouter();
  return (
    <Pressable
      testID="feed-back"
      onPress={() => {
        router.back();
      }}
    />
  );
}

describe('a landing on the Word of the Day card', () => {
  it('opens the Feed once, so a return to the Dashboard stays there when the Feed lacks the card', async () => {
    const app = await openApp(FeedWithoutTheCard);
    const onboarding = ['start', 'next', 'next', 'answer-good', 'later', 'done', 'time-20:30'];
    for (const step of onboarding) await press(`onboarding-${step}`);
    await settle(() => fireEvent.press(screen.getByText(editionStrings.dashboard.toCard)));
    expect(app.pathname()).toBe('/feed');
    screenSettled();
    await back('feed-back');
    await settle();
    expect(app.pathname()).toBe('/');
  });
});
