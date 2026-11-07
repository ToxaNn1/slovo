import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { loadEdition, openComposition, systemRandom, type Composition } from '@slovo/core';
import { createFakeBackend, createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Tabs } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SavedLayout from '../app/saved/_layout';
import SavedScreen from '../app/saved/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { SettingsProvider } from '../settings/settings';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const { config } = activeEditionFiles;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

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
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [word('w_one', 'тихий'), word('w_two', 'лагідний')],
    }),
    edition: loadEdition(config),
    userState: await seedUserState(),
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

/** The app's tabs with the Saved tab's stack, on `url`. */
async function renderApp(url: string) {
  const app = await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider
            shell={testShell({
              composition: opened(composition),
              remoteSwitches: switchedTo(edition),
            })}
          >
            <SettingsProvider>
              <EditionProvider edition={edition} strings={editionStrings}>
                {/* Expo Router 58 draws only the screens a Tabs layout declares. */}
                <Tabs screenOptions={{ headerShown: false }}>
                  <Tabs.Screen name="index" />
                  <Tabs.Screen name="search/index" />
                  <Tabs.Screen name="saved" />
                </Tabs>
              </EditionProvider>
            </SettingsProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      index: () => <Text>Feed</Text>,
      'search/index': () => <Text>Search</Text>,
      'saved/_layout': SavedLayout,
      'saved/index': SavedScreen,
    },
    { initialUrl: url },
  );
  await settle();
  return { pathname: () => app.getPathname() };
}

describe('the Saved tab', () => {
  it('shows the list of the tab tapped in place', async () => {
    const app = await renderApp('/saved');

    await settle(() => fireEvent.press(screen.getByTestId('saved-history')));

    expect(app.pathname()).toBe('/saved');
    expect(screen.getByTestId('saved-history')).toBeSelected();
    expect(screen.getByTestId('history-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('favorites')).not.toBeOnTheScreen();
  });

  it('keeps the row of tabs, and where it was scrolled to, when a tab is tapped', async () => {
    await renderApp('/saved');
    const row = screen.getByTestId('saved-row');

    await settle(() => fireEvent.press(screen.getByTestId('saved-collections')));

    expect(screen.getByTestId('collections-empty')).toBeOnTheScreen();
    // The same row, never drawn afresh at its start.
    expect(screen.getByTestId('saved-row')).toBe(row);
  });

  it('opens on the list its `list` parameter names', async () => {
    await renderApp('/saved?list=collections');

    expect(screen.getByTestId('saved-collections')).toBeSelected();
    expect(screen.getByTestId('collections-empty')).toBeOnTheScreen();
  });

  it('opens Search from its search field', async () => {
    const app = await renderApp('/saved');

    await settle(() => fireEvent.press(screen.getByTestId('saved-search')));

    expect(app.pathname()).toBe('/search');
  });
});
