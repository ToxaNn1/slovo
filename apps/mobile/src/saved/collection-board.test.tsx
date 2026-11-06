import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fill, pluralCount, type Idiom, type Word } from '@slovo/contracts';
import { loadEdition, openComposition, systemRandom, type Composition } from '@slovo/core';
import { createFakeBackend, createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Tabs } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CollectionScreen from '../app/saved/collections/[collectionId]';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const { config } = activeEditionFiles;
const { collections: strings } = editionStrings;
const { known: knownText } = editionStrings.dashboard.category;
const menuLabel = fill(strings.screen.moreLabel, { name: 'Осінь' });
const count = pluralCount(edition.locale);

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;
/** Whether the Collection board style is on in effect, as a remote switch leaves it. */
let boardStyleOn: boolean;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** A Word with its Lemma and nothing else the screen reads. */
const word = (id: string, lemma: string): Word => ({
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
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Словник' }],
  correctionIds: [],
  retired: false,
});

const idiom: Idiom = {
  kind: 'idiom',
  id: 'i_idle',
  expression: 'бити байдики',
  idiomType: 'idiom',
  primaryDefinition: 'Ледарювати.',
  extraDefinitions: [],
  examples: [],
  sources: [{ title: 'Словник' }],
  retired: false,
};

beforeEach(async () => {
  jest.useFakeTimers();
  boardStyleOn = true;
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [word('w_one', 'тихий'), word('w_two', 'лагідний')],
      idioms: [idiom],
    }),
    edition: loadEdition(config),
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-29T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    backend: createFakeBackend().backend,
  });
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

/** Runs an action, and lets the navigators and the composition finish it. */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    // The sheets slide by the clock: a second is longer than any of them.
    await jest.advanceTimersByTimeAsync(1_000);
  });
}

/** A Collection named «Осінь» holding `entryIds`, the first added first. */
async function collectionOf(entryIds: readonly string[]): Promise<string> {
  const created = await composition.collections.create('Осінь');
  if (!created.ok) throw new Error(`The Collection was refused: ${created.reason}`);
  for (const entryId of entryIds) await composition.collections.add(created.collection.id, entryId);
  return created.collection.id;
}

/** The Saved tab's Collection screen of `collectionId`, with the board style as a test leaves it. */
async function renderCollection(collectionId: string) {
  const editionInEffect: typeof edition = {
    ...edition,
    isFeatureEnabled: (feature) =>
      feature === 'collectionBoardStyle' ? boardStyleOn : edition.isFeatureEnabled(feature),
  };
  const app = renderRouter(
    {
      _layout: () => (
        <GestureHandlerRootView>
          <SafeAreaProvider initialMetrics={metrics}>
            <ShellProvider
              shell={testShell({
                composition: opened(composition),
                remoteSwitches: switchedTo(editionInEffect),
              })}
            >
              <EditionProvider edition={edition} strings={editionStrings}>
                <Tabs screenOptions={{ headerShown: false }} />
              </EditionProvider>
            </ShellProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      ),
      index: () => <Text>Feed</Text>,
      'saved/collections/index': () => <Text>Collections</Text>,
      'saved/collections/[collectionId]/index': CollectionScreen,
    },
    { initialUrl: `/saved/collections/${collectionId}` },
  );
  await app;
  await settle();
  return { pathname: () => app.getPathname() };
}

const kicker = (amount: number) =>
  fill(strings.screen.kicker, { count: count(strings.screen.wordCount, amount) });
const known = (x: number, n: number) => fill(knownText, { x: String(x), n: String(n) });

describe('a Collection in the board style', () => {
  it('reads «КОЛЕКЦІЯ · N слів», its name and no description, and «ЗНАЮ x З n» of its Entries', async () => {
    const id = await collectionOf(['w_one', 'w_two', 'i_idle']);
    await composition.knowledge.set('w_one', 'known');
    await renderCollection(id);

    expect(screen.getByTestId('collection-hero-kicker')).toHaveTextContent(kicker(3));
    expect(screen.getByRole('header', { name: 'Осінь' })).toBeOnTheScreen();
    expect(screen.queryByTestId('collection-hero-description')).not.toBeOnTheScreen();
    expect(screen.getByTestId('collection-hero-progress')).toHaveTextContent(known(1, 3));
  });

  it('opens the Collection menu with rename, share and delete', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: menuLabel })));

    expect(screen.getByRole('button', { name: strings.screen.menu.rename })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: strings.link.share })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: strings.screen.menu.delete })).toBeOnTheScreen();
  });

  it('renames the Collection from its menu', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: menuLabel })));
    await settle(() => fireEvent.press(screen.getByTestId('collection-menu-rename')));
    // The menu slides away first, then what it chose opens.
    await settle();
    await settle(() => {
      fireEvent.changeText(screen.getByDisplayValue('Осінь'), 'Зима');
    });
    await settle(() => fireEvent(screen.getByDisplayValue('Зима'), 'submitEditing'));

    expect(screen.getByRole('header', { name: 'Зима' })).toBeOnTheScreen();
  });

  it('deletes the Collection from its menu and goes back to Collections', async () => {
    const id = await collectionOf(['w_one']);
    const app = await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: menuLabel })));
    await settle(() => fireEvent.press(screen.getByTestId('collection-menu-delete')));
    // The menu slides away first, then what it chose opens.
    await settle();
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: strings.screen.confirmDelete.confirm })),
    );

    expect(composition.collections.list).toHaveLength(0);
    expect(app.pathname()).toBe('/saved/collections');
  });

  it('draws a Word card with bars and an Idiom card with its meaning and no bars', async () => {
    const id = await collectionOf(['w_one', 'i_idle']);
    await renderCollection(id);

    expect(screen.getAllByTestId(/^collection-entry-w_one-bar-/)).toHaveLength(5);
    expect(screen.getByTestId('collection-entry-i_idle')).toHaveTextContent(/Ледарювати\./);
    expect(screen.queryAllByTestId(/^collection-entry-i_idle-bar-/)).toHaveLength(0);
  });

  it('shows the hero and no cards for an empty Collection', async () => {
    const id = await collectionOf([]);
    await renderCollection(id);

    expect(screen.getByTestId('collection-hero-kicker')).toHaveTextContent(kicker(0));
    expect(screen.getByTestId('collection-hero-progress')).toHaveTextContent(known(0, 0));
    expect(screen.queryAllByTestId(/^collection-entry-/)).toHaveLength(0);
    expect(screen.queryByTestId('collection-empty')).not.toBeOnTheScreen();
  });

  // DESIGN-05: not on the board, owner decides
  it.skip('closes the list with «Найновіші — першими…»', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    expect(screen.getByText(strings.entries.footer)).toBeOnTheScreen();
  });

  // DESIGN-05: not on the board, owner decides
  it.skip('takes an Entry out of the Collection on a swipe', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() =>
      fireEvent.press(
        screen.getByRole('button', {
          name: fill(strings.entries.removeLabel, { title: 'тихий', name: 'Осінь' }),
        }),
      ),
    );

    expect(composition.collections.entries(id)).toHaveLength(0);
  });

  // DESIGN-05: not on the board, owner decides
  it.skip('shows each Entry’s kind and when it was added, «слово · 3 лист.»', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    expect(screen.getByTestId('collection-entry-w_one')).toHaveTextContent(/29 жовт\./);
  });
});

describe('a Collection with the board style off', () => {
  it('is today’s screen: the back link, the name with its count and the footer', async () => {
    boardStyleOn = false;
    const id = await collectionOf(['w_one', 'i_idle']);
    await renderCollection(id);

    expect(screen.getByTestId('collection-back')).toBeOnTheScreen();
    expect(screen.getByTestId('collection-count')).toHaveTextContent('2');
    expect(screen.getByText(strings.entries.footer)).toBeOnTheScreen();
    expect(screen.queryByTestId('collection-hero-kicker')).not.toBeOnTheScreen();
  });
});
