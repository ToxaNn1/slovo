import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import { createFakeBackend, createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { router, Tabs } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CollectionLinkScreen from '../app/c/[linkId]';
import SavedLayout from '../app/saved/_layout';
import CollectionScreen from '../app/saved/collections/[collectionId]';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { screenSettled } from '../entries/use-open-screen';

const { config } = activeEditionFiles;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const { collections: strings } = editionStrings;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** A Word with its Lemma and nothing else the screens read. */
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

const api = createFakeBackend();

beforeEach(async () => {
  jest.useFakeTimers();
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: [word('w_one', 'тихий'), word('w_two', 'лагідний')],
    }),
    edition: loadEdition(config),
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: { now: () => new Date('2026-10-29T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    backend: api.backend,
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
    await jest.runAllTimersAsync();
  });
}

/** The app's tabs, with the Saved tab's stack and the recipient sheet, on `url`. */
async function renderApp(url: string) {
  const app = renderRouter(
    {
      _layout: () => (
        <GestureHandlerRootView>
          <SafeAreaProvider initialMetrics={metrics}>
            <ShellProvider shell={testShell({ composition: opened(composition) })}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <Tabs screenOptions={{ headerShown: false }} />
              </EditionProvider>
            </ShellProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      ),
      index: () => <Text>Feed</Text>,
      'c/[linkId]': CollectionLinkScreen,
      'saved/_layout': SavedLayout,
      'saved/index': () => <Text>Saved</Text>,
      'saved/collections/index': () => <Text>Collections</Text>,
      'saved/collections/[collectionId]/index': CollectionScreen,
    },
    { initialUrl: url },
  );
  await app;
  await settle();
  return { pathname: () => app.getPathname() };
}

/** Presses the Collection screen's «Колекції». */
const pressBack = () =>
  settle(() => fireEvent.press(screen.getByRole('button', { name: strings.title })));

describe('«Колекції» on a Collection', () => {
  it('opens Collections from the copy «Додати собі» made of a Collection Link', async () => {
    const made = await api.backend.collectionLinks.create({
      edition: edition.id,
      name: 'Осінь',
      entryIds: ['w_one', 'w_two'],
    });
    const app = await renderApp(`/c/${made.id}`);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: strings.link.add })));
    const [copy] = composition.collections.list;
    expect(app.pathname()).toBe(`/saved/collections/${copy?.id ?? ''}`);

    await pressBack();

    expect(app.pathname()).toBe('/saved/collections');
    expect(screen.getByText('Collections')).toBeOnTheScreen();
  });

  it('goes back to Collections it was opened from', async () => {
    const created = await composition.collections.create('Осінь', 'w_one');
    if (!created.ok) throw new Error(`The Collection was refused: ${created.reason}`);
    const app = await renderApp('/saved/collections');

    await settle(() => {
      router.push(`/saved/collections/${created.collection.id}`);
    });
    expect(screen.getByText('Осінь')).toBeOnTheScreen();
    await pressBack();

    expect(app.pathname()).toBe('/saved/collections');
    expect(screen.getByText('Collections')).toBeOnTheScreen();
  });
});
