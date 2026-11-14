import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fill, pluralCount, type Idiom, type Word } from '@slovo/contracts';
import { loadEdition, openComposition, systemRandom, type Composition } from '@slovo/core';
import { createFakeBackend, createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Tabs } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import * as Clipboard from 'expo-clipboard';
import { Share, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CollectionScreen from '../app/saved/collections/[collectionId]';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const { config } = activeEditionFiles;
const { collections: strings } = editionStrings;
const menuLabel = fill(strings.screen.moreLabel, { name: 'Осінь' });
const count = pluralCount(edition.locale);

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;
/** Whether the Collection board style is on in effect, as a remote switch leaves it. */
let boardStyleOn: boolean;
/** Whether «Скопіювати посилання» is on in effect, as a remote switch leaves it. */
let linkCopyOn: boolean;

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

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
  linkCopyOn = true;
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
async function renderCollection(collectionId: string, query = '') {
  const editionInEffect: typeof edition = {
    ...edition,
    isFeatureEnabled: (feature) =>
      feature === 'collectionBoardStyle'
        ? boardStyleOn
        : feature === 'collectionLinkCopy'
          ? linkCopyOn
          : edition.isFeatureEnabled(feature),
  };
  const app = await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider
            shell={testShell({
              composition: opened(composition),
              remoteSwitches: switchedTo(editionInEffect),
            })}
          >
            <EditionProvider edition={edition} strings={editionStrings}>
              {/* Expo Router 58 draws only the screens a Tabs layout declares. */}
              <Tabs screenOptions={{ headerShown: false }}>
                <Tabs.Screen name="index" />
                <Tabs.Screen name="saved/collections/index" />
                <Tabs.Screen name="saved/collections/[collectionId]/index" />
                <Tabs.Screen name="saved/collections/[collectionId]/[entryId]" />
              </Tabs>
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      index: () => <Text>Feed</Text>,
      'saved/collections/index': () => <Text>Collections</Text>,
      'saved/collections/[collectionId]/index': CollectionScreen,
      'saved/collections/[collectionId]/[entryId]': () => <Text>Entry</Text>,
    },
    { initialUrl: `/saved/collections/${collectionId}${query}` },
  );
  await settle();
  return { pathname: () => app.getPathname() };
}

const wordCount = (amount: number) => count(strings.screen.wordCount, amount);

describe('a Collection in the board style', () => {
  it('reads its name and «N слів» over its Entries as rows, each with its meaning', async () => {
    const id = await collectionOf(['w_one', 'i_idle']);
    await renderCollection(id);

    expect(screen.getByRole('header', { name: 'Осінь' })).toBeOnTheScreen();
    expect(screen.getByTestId('collection-count')).toHaveTextContent(wordCount(2));
    expect(screen.getByTestId('collection-row-w_one-open')).toHaveTextContent(/тихий/);
    expect(screen.getByTestId('collection-row-i_idle-open')).toHaveTextContent(/Ледарювати\./);
    expect(screen.queryByTestId('collection-hero-kicker')).not.toBeOnTheScreen();
  });

  it('opens an Entry from its row', async () => {
    const id = await collectionOf(['w_one']);
    const app = await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByTestId('collection-row-w_one-open')));

    expect(app.pathname()).toBe(`/saved/collections/${id}/w_one`);
  });

  it('takes an Entry out of the Collection on a swipe', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() =>
      fireEvent(screen.getByTestId('collection-row-w_one-open'), 'accessibilityAction', {
        nativeEvent: { actionName: 'remove' },
      }),
    );

    expect(composition.collections.entries(id)).toHaveLength(0);
  });

  it('shares the link from the foot of a Collection with Entries', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    expect(screen.getByRole('button', { name: strings.link.share })).toBeOnTheScreen();
  });

  it('opens the share sheet from the foot with the Collection Link, and copies it', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: strings.link.share })));

    const sheet = screen.getByTestId('collection-share-sheet');
    expect(within(sheet).getByText(strings.shareSheet.snapshot)).toBeOnTheScreen();
    const link = within(sheet).getByTestId('collection-share-sheet-link');
    expect(link).toHaveTextContent(/\/uk\/c\/[A-Za-z0-9]+$/);
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: strings.shareSheet.copy })),
    );

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/.+\/uk\/c\/[A-Za-z0-9]+$/),
    );
    expect(screen.getByText(strings.toasts.copied)).toBeOnTheScreen();
  });

  it('opens the system Share from the share sheet once the sheet has slid away', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: strings.link.share })));
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: strings.shareSheet.share })),
    );
    // The share sheet slides away first, then the system Share opens.
    await settle();

    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('Колекція «Осінь» у SLOVO: https://'),
    });
    share.mockRestore();
  });

  it('keeps the system Share alone on the share sheet while copying is off', async () => {
    linkCopyOn = false;
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: strings.link.share })));

    expect(screen.queryByRole('button', { name: strings.shareSheet.copy })).toBeNull();
    expect(screen.getByRole('button', { name: strings.shareSheet.share })).toBeOnTheScreen();
  });

  it('opens the Collection menu under its name with share, rename and delete', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: menuLabel })));

    expect(within(screen.getByTestId('collection-menu')).getByText('Осінь')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: strings.screen.menu.rename })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: strings.link.share })).toHaveLength(2);
    expect(screen.getByRole('button', { name: strings.screen.menu.delete })).toBeOnTheScreen();
  });

  it('renames the Collection in the name sheet and says so', async () => {
    const id = await collectionOf(['w_one']);
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: menuLabel })));
    await settle(() => fireEvent.press(screen.getByTestId('collection-menu-rename')));
    // The menu slides away first, then what it chose opens.
    await settle();
    await settle(() => fireEvent.changeText(screen.getByDisplayValue('Осінь'), 'Зима'));
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: strings.nameSheet.save })),
    );

    expect(screen.getByRole('header', { name: 'Зима' })).toBeOnTheScreen();
    expect(screen.getByText(strings.toasts.renamed)).toBeOnTheScreen();
  });

  it('keeps the name sheet open with why a name is refused', async () => {
    const id = await collectionOf(['w_one']);
    await composition.collections.create('Зима');
    await renderCollection(id);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: menuLabel })));
    await settle(() => fireEvent.press(screen.getByTestId('collection-menu-rename')));
    await settle();
    await settle(() => fireEvent.changeText(screen.getByDisplayValue('Осінь'), 'зима'));
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: strings.nameSheet.save })),
    );

    expect(screen.getByText(strings.sheet.refusal.duplicate)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Осінь' })).toBeOnTheScreen();
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

  it('says an empty Collection is empty, with no share at the foot', async () => {
    const id = await collectionOf([]);
    await renderCollection(id);

    expect(screen.getByTestId('collection-count')).toHaveTextContent(wordCount(0));
    expect(screen.getByTestId('collection-empty')).toHaveTextContent(
      new RegExp(strings.entries.empty.title),
    );
    expect(screen.queryByTestId('collection-share')).not.toBeOnTheScreen();
  });

  it('says the Collection just made is made', async () => {
    const id = await collectionOf([]);
    await renderCollection(id, '?created=1');

    expect(screen.getByText(fill(strings.toasts.created, { name: 'Осінь' }))).toBeOnTheScreen();
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
