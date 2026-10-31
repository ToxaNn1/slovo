import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
} from '@slovo/core';
import { createFakeBackend, createMemoryContentPort, type FakeBackend } from '@slovo/core/testing';
import { EditionProvider, systemSchedule } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CollectionsScreen from '../app/saved/collections/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';

const { config } = activeEditionFiles;

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

/** Whether a test turned `collectionLinks` off, as a remote switch does. */
let collectionLinksOff: boolean;

/** The backend of Collection Links, online unless a test takes it off. */
let api: FakeBackend;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: () => undefined, push: () => undefined }),
}));

const strings = editionStrings.collections.link;

/** A Word with its Lemma and nothing else the screen reads. */
const word = (id: string, lemma: string): Word => ({
  kind: 'word',
  id,
  lemma,
  stress: [1],
  partOfSpeech: 'noun',
  primaryDefinition: `The meaning of ${lemma}.`,
  extraDefinitions: [],
  examples: [{ text: `Речення: ${lemma}.` }],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let share: jest.SpiedFunction<typeof Share.share>;

/** The device's time, which moves a minute on with each Entry a test adds. */
let now: number;

beforeEach(async () => {
  jest.useFakeTimers();
  share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  api = createFakeBackend({ linkDomain: 'slovo.example' });
  collectionLinksOff = false;
  const loaded = loadEdition(config);
  /** The Edition as the app runs it, `collectionLinks` on unless a test turns it off. */
  const inEffect: Edition = {
    ...loaded,
    isFeatureEnabled: (feature) =>
      !(feature === 'collectionLinks' && collectionLinksOff) && loaded.isFeatureEnabled(feature),
  };
  now = Date.parse('2026-10-28T09:00:00Z');
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: [word('w_kvasha', 'кваша'), word('w_buzok', 'бузок')],
    }),
    edition: inEffect,
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    schedule: systemSchedule,
    backend: api.backend,
  });
});

afterEach(() => {
  share.mockRestore();
  jest.useRealTimers();
});

/** Makes a Collection with the Entries, added a minute apart in order, and answers its id. */
async function collection(name: string, entryIds: readonly string[] = []) {
  const created = await composition.collections.create(name);
  if (!created.ok) throw new Error(`"${name}" was refused: ${created.reason}`);
  const { id } = created.collection;
  for (const entryId of entryIds) {
    now += 60_000;
    await composition.collections.add(id, entryId);
  }
  return id;
}

/** Lets the requests, the waits between tries, the sheet's slide and the renders after them finish. */
async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });
}

async function openMenuOf(collectionId: string) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <CollectionsScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await settle();
  await fireEvent.press(screen.getByTestId(`collection-${collectionId}-more`));
  await settle();
}

async function shareFromMenu() {
  await fireEvent.press(screen.getByTestId('collections-menu-share'));
  await settle();
}

/** The toast's message, waited for while the tries go on, since it leaves 4 s after it shows. */
async function toast() {
  await fireEvent.press(screen.getByTestId('collections-menu-share'));
  return screen.findByTestId('undo-toast-message', {}, { timeout: 10_000 });
}

describe('«Поділитися посиланням» in a Collection’s menu', () => {
  it('opens the share sheet with «Колекція «Осінь» у SLOVO: …» and the new link', async () => {
    const autumn = await collection('Осінь', ['w_kvasha', 'w_buzok']);
    await openMenuOf(autumn);

    expect(screen.getByRole('button', { name: strings.share })).toBeEnabled();
    await shareFromMenu();

    expect(api.collectionLinks.made).toEqual([
      { edition: 'uk', name: 'Осінь', entryIds: ['w_buzok', 'w_kvasha'] },
    ]);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      message: 'Колекція «Осінь» у SLOVO: https://slovo.example/c/link000001',
    });
    expect(screen.queryByTestId('undo-toast')).not.toBeOnTheScreen();
  });

  it('is disabled on an empty Collection and shares nothing', async () => {
    const empty = await collection('Порожня');
    await openMenuOf(empty);

    const row = screen.getByRole('button', { name: strings.share });
    expect(row).toBeDisabled();
    await shareFromMenu();

    expect(api.calls).toHaveLength(0);
    expect(share).not.toHaveBeenCalled();
  });

  it('says «Немає з’єднання. Спробуйте пізніше.» offline and shares nothing', async () => {
    const autumn = await collection('Осінь', ['w_kvasha']);
    api.online = false;
    await openMenuOf(autumn);

    expect(await toast()).toHaveTextContent('Немає з’єднання. Спробуйте пізніше.');
    expect(api.collectionLinks.made).toEqual([]);
    expect(share).not.toHaveBeenCalled();
  });

  it('says it failed when the backend makes no link', async () => {
    const autumn = await collection('Осінь', ['w_kvasha']);
    api.failNext('too-many-requests');
    await openMenuOf(autumn);

    expect(await toast()).toHaveTextContent(strings.failed);
    expect(share).not.toHaveBeenCalled();
  });

  it('is not offered while Collection Links are switched off', async () => {
    const autumn = await collection('Осінь', ['w_kvasha']);
    collectionLinksOff = true;
    await openMenuOf(autumn);

    expect(screen.queryByRole('button', { name: strings.share })).not.toBeOnTheScreen();
    expect(screen.getByTestId('collections-menu-rename')).toBeOnTheScreen();
  });
});
