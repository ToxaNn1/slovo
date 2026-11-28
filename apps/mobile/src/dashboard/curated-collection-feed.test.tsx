import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import { openComposition, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { View } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import CuratedCollectionScreen from '../app/curated-collection/[collectionId]';
import CuratedCollectionFeedScreen from '../app/curated-collection-feed/[collectionId]';
import EntryFromSearchScreen from '../app/search/[entryId]';
import { activeEditionFiles } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

function word(id: string, lemma: string, retired = false): Word {
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
    retired,
  };
}

function correction(id: string, nonStandardForm: string): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType: 'surzhyk',
    standardEquivalents: ['ніби'],
    explanation: `Пояснення до ${nonStandardForm}.`,
    examplePair: { nonStandard: 'Так кажуть.', standard: 'Так краще.' },
    categoryId: 'everyday',
    sources: [{ title: 'Словник' }],
    literaryUses: [],
    retired: false,
  };
}

let composition: Composition;
let shellOf: () => ReturnType<typeof testShell>;

/**
 * Opens the composition over the Curated Collection «Мішанина»: the Correction
 * типу, the Words тихий and сумирний and a Retired Word between them.
 */
async function open({ curatedCollectionFeed = true } = {}) {
  const shipped = loadEdition(activeEditionFiles.config);
  const editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature: Parameters<typeof shipped.isFeatureEnabled>[0]) =>
      feature === 'curatedCollectionFeed'
        ? curatedCollectionFeed
        : feature === 'curatedCollections' || shipped.isFeatureEnabled(feature),
  };
  const userState = await seedUserState(
    {
      onboardingFinished: '2026-09-01T09:00:00.000Z',
      // Today's Word of the Day is outside the collection, so no card is its hero.
      wordOfTheDay: { entryId: 'w_den', date: '2026-10-28' },
    },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [
        word('w_tykhyi', 'тихий'),
        word('w_staryi', 'старий', true),
        word('w_sumyrnyi', 'сумирний'),
        word('w_den', 'денний'),
      ],
      correctionCategories: [
        { id: 'everyday', displayName: 'Щоденне', description: 'Щоденне.', tone: 'loud' },
      ],
      corrections: [correction('c_tipa', 'типу')],
      curatedCollections: [
        {
          id: 'cc_mishani',
          name: 'Мішанина',
          description: 'Слова й Виправлення впереміш.',
          publishedOn: '2026-10-25',
          retired: false,
          entryIds: ['c_tipa', 'w_tykhyi', 'w_staryi', 'w_sumyrnyi'],
        },
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
  shellOf = () =>
    testShell({
      userState: opened(userState),
      remoteSwitches: switchedTo(editionInEffect),
      composition: opened(composition),
    });
}

beforeEach(() => {
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

/** The app on the collection's screen, with the routes its cards open. */
async function renderCollection(initialUrl = '/curated-collection/cc_mishani') {
  await renderApp(
    {
      index: () => <View testID="home" />,
      'curated-collection/[collectionId]': CuratedCollectionScreen,
      'curated-collection-feed/[collectionId]': CuratedCollectionFeedScreen,
      'search/[entryId]': EntryFromSearchScreen,
    },
    { shell: shellOf(), initialUrl },
  );
  await settle();
}

const ACTIVATION = 12;

/** Turns the collection's Feed to its next card. */
async function swipeUp() {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('curated-collection-feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
    await jest.advanceTimersByTimeAsync(500);
  });
}

/** Lays the Feed out on a phone's screen, as the pager draws its pages only then. */
async function layOut() {
  await settle(() =>
    fireEvent(screen.getByTestId('curated-collection-feed'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } },
    }),
  );
}

const page = (position: number) =>
  within(screen.getByTestId(`curated-collection-feed-card-${String(position)}`));

describe("a Curated Collection's Feed", () => {
  it('opens on the tapped Entry, each kind on its own card with its place, and goes round again', async () => {
    await open();
    await renderCollection();

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-entry-w_tykhyi')));
    await layOut();

    expect(screen.queryByTestId('curated-collection-hero')).toBeNull();
    const cards = [
      // The place counts from the tapped Entry, as in a Category's Feed.
      ['word', 'Значення слова тихий.', 1],
      ['word', 'Значення слова сумирний.', 2],
      ['correction', 'типу', 3],
      ['word', 'Значення слова тихий.', 1],
    ] as const;
    for (const [position, [kind, text, place]] of cards.entries()) {
      if (position > 0) await swipeUp();
      const card = page(position);
      expect(card.getByTestId(`${kind}-card`)).toBeTruthy();
      expect(card.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
      expect(card.getByTestId(`${kind}-card-kicker`)).toHaveTextContent(
        `Добірка\u00a0· Мішанина\u00a0· ${String(place)}\u00a0з\u00a03`,
      );
    }
  });

  it('makes nothing Seen and leaves History as it was', async () => {
    await open();
    await renderCollection();

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-entry-c_tipa')));
    await layOut();
    await swipeUp();
    await settle(() => jest.advanceTimersByTimeAsync(10_000));

    expect(composition.history.list).toEqual([]);
  });

  it('leads back to the collection screen by its back tile, named for the collection', async () => {
    await open();
    await renderCollection();
    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-entry-w_tykhyi')));

    await settle(() => fireEvent.press(screen.getByRole('button', { name: 'Мішанина' })));

    expect(screen.getByTestId('curated-collection')).toBeTruthy();
  });

  it('returns home for a collection with no screen, as its screen does', async () => {
    await open();
    await renderCollection('/curated-collection-feed/cc_unknown?from=w_tykhyi');

    expect(screen.getByTestId('home')).toBeTruthy();
    expect(screen.queryByTestId('curated-collection-feed-screen')).toBeNull();
  });

  it('with its switch off, a tap opens the Entry card as Search does, and nothing is Seen', async () => {
    await open({ curatedCollectionFeed: false });
    await renderCollection();

    await settle(() => fireEvent.press(screen.getByTestId('curated-collection-entry-w_tykhyi')));

    expect(screen.queryByTestId('curated-collection-feed-screen')).toBeNull();
    expect(screen.getByTestId('entry-screen')).toBeTruthy();
    expect(screen.getByText('Значення слова тихий.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });
});
