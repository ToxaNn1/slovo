import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  trackChanges,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Linking, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import CollectionScreen from '../app/saved/collections/[collectionId]';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { edition, editionStrings } from '../edition/edition';
import { createOutsideLinks } from '../entries/entry-link';
import { screenSettled } from '../entries/use-open-screen';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition = loadEdition(config);

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;
// The Entry card's action row has its own tests.
jest.mock('../entries/entry-actions', () => ({ EntryActions: () => null }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** A Word of the Edition's first Category. */
function word(id: string, lemma: string): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [0],
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

beforeEach(async () => {
  jest.useFakeTimers();
  userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: [word('w_sumyrnyi', 'сумирний')],
    }),
    edition: shippedEdition,
    userState,
    clock,
    random: systemRandom,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  screenSettled();
});

/** Runs what a link starts, and lets the navigators and the composition finish it. */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

/**
 * The app on the Feed, with its Entry and Collection routes and the outside
 * links of `+native-intent`. `tap` opens a Spotlight result as the Swift
 * module does: the link of its route, the Edition's scheme + the route.
 */
async function renderApp() {
  const listeners: ((event: { url: string }) => void)[] = [];
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof Linking.addEventListener>;
  });
  // The settings and the screens open over this test's user state and composition.
  const shell = testShell({
    userState: opened(trackChanges({ userState, clock })),
    remoteSwitches: switchedTo(shippedEdition),
    composition: opened(composition),
  });
  const app = renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <SettingsProvider>
                <Slot />
              </SettingsProvider>
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      '+native-intent': {
        redirectSystemPath: createOutsideLinks({
          linkDomain: edition.linkDomain,
          widgetLinkKey: () => Promise.resolve(undefined),
          appIntents: { on: () => Promise.resolve(true), landOnWordOfTheDay: () => undefined },
          // With no Widget Snapshot no link is the widget's.
          widgetEntries: { replaceOpenEntry: () => Promise.resolve(true), open: () => undefined },
        }),
      },
      index: () => <Text>Feed</Text>,
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
      'saved/collections/[collectionId]/index': CollectionScreen,
    },
    { initialUrl: '/' },
  );
  await app;
  await settle();
  return {
    pathname: () => app.getPathname(),
    tap: (route: string) =>
      settle(() => {
        for (const listener of listeners) listener({ url: `slovo-uk://${route}` });
      }),
  };
}

/** The Spotlight Snapshot the shell hands the iPhone search now. */
const snapshot = () =>
  composition.spotlight.snapshot({
    notificationBody: editionStrings.notificationBody,
    spotlight: editionStrings.spotlight,
  });

describe('a tap on a Spotlight result', () => {
  it('on an Entry opens its Entry screen as a plain link: not Seen, in no History', async () => {
    await composition.favorites.add('w_sumyrnyi');
    const [result] = (await snapshot()).entries;
    const app = await renderApp();

    await app.tap(result?.route ?? '');

    expect(app.pathname()).toBe('/entry/w_sumyrnyi');
    expect(screen.getByText('Значення слова сумирний.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });

  it('on a Collection opens that Collection', async () => {
    await composition.collections.create('Тихі слова', 'w_sumyrnyi');
    const [result] = (await snapshot()).collections;
    const app = await renderApp();

    await app.tap(result?.route ?? '');

    expect(app.pathname()).toBe(`/saved/collections/${result?.id ?? ''}`);
    expect(screen.getByText('Тихі слова')).toBeTruthy();
  });

  it('on an Entry the Language Pack no longer has opens the app’s start', async () => {
    const app = await renderApp();

    // An index written before a pack update that took the Entry out.
    await app.tap('entry/w_vyluchenyi');

    expect(app.pathname()).toBe('/');
    expect(screen.getByText('Feed')).toBeTruthy();
  });
});
