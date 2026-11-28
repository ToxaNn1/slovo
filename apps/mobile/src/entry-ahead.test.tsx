import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { openComposition, systemRandom, type AnyEntryCard, type Composition } from '@slovo/core';
import {
  createMemoryContentPort,
  loadEdition,
  seedUserState,
  createFakeBackend,
} from '@slovo/core/testing';
import { Tabs, useRouter } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import { activeEditionFiles } from './edition/edition';
import { renderApp } from './shell/test-app';
import { opened, testShell } from './shell/test-support';
import { screenSettled, useOpenScreen } from './use-open-screen';
import { entryReadAhead, useOpenEntry } from './entry-ahead';

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

let composition: Composition;
/** The reads of Entry cards the taps started, each resolved by the test. */
let reads: Map<string, (card: AnyEntryCard | undefined) => void>;

beforeEach(async () => {
  jest.useFakeTimers();
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [word('w_one', 'тихий'), word('w_two', 'лагідний')],
    }),
    edition: loadEdition(activeEditionFiles.config),
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-29T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    backend: createFakeBackend().backend,
  });
  reads = new Map();
  const read = composition.entryCard.bind(composition);
  jest.spyOn(composition, 'entryCard').mockImplementation(async (entryId) => {
    const card = await read(entryId);
    return new Promise((resolve) => {
      reads.set(entryId, () => {
        resolve(card);
      });
    });
  });
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

/** A list whose rows open an Entry, a screen that opens over it, and a way to another tab. */
function List() {
  const openEntry = useOpenEntry();
  const router = useRouter();
  const openScreen = useOpenScreen();
  return (
    <>
      {['w_one', 'w_two'].map((entryId) => (
        <Pressable
          key={entryId}
          testID={`open-${entryId}`}
          accessibilityRole="button"
          onPress={() => {
            openEntry(entryId, `/list/${entryId}`);
          }}
        />
      ))}
      <Pressable
        testID="busy"
        accessibilityRole="button"
        onPress={() => {
          openScreen('/list');
        }}
      />
      <Pressable
        testID="leave"
        accessibilityRole="button"
        onPress={() => {
          router.navigate('/other');
        }}
      />
    </>
  );
}

async function renderList() {
  const app = await renderApp(
    {
      _layout: () => (
        <Tabs screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="list/index" />
          <Tabs.Screen name="list/[entryId]" />
          <Tabs.Screen name="other" />
        </Tabs>
      ),
      'list/index': List,
      'list/[entryId]': () => <Text>Entry</Text>,
      other: () => <Text>Other</Text>,
    },
    { shell: testShell({ composition: opened(composition) }), initialUrl: '/list' },
  );
  await settle();
  return { pathname: () => app.getPathname() };
}

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.advanceTimersByTimeAsync(100);
  });
}

/** Ends the read of `entryId`'s card. */
const readDone = (entryId: string) =>
  settle(() => {
    reads.get(entryId)?.(undefined);
  });

describe('useOpenEntry', () => {
  it('opens the Entry tapped once its card is read', async () => {
    const app = await renderList();

    await settle(() => fireEvent.press(screen.getByTestId('open-w_one')));
    await readDone('w_one');

    expect(app.pathname()).toBe('/list/w_one');
  });

  it('opens nothing when the reader left the list before the card was read', async () => {
    const app = await renderList();

    await settle(() => fireEvent.press(screen.getByTestId('open-w_one')));
    await settle(() => fireEvent.press(screen.getByTestId('leave')));
    await readDone('w_one');

    expect(app.pathname()).toBe('/other');
  });

  it('opens the last Entry tapped, not one an earlier tap read later', async () => {
    const app = await renderList();

    await settle(() => fireEvent.press(screen.getByTestId('open-w_one')));
    await settle(() => fireEvent.press(screen.getByTestId('open-w_two')));
    await readDone('w_one');
    await readDone('w_two');

    expect(app.pathname()).toBe('/list/w_two');
  });

  it('keeps no card ahead for a tap whose screen did not open', async () => {
    await renderList();

    // Another screen is still opening, so this tap's screen is not opened.
    await settle(() => fireEvent.press(screen.getByTestId('busy')));
    await settle(() => fireEvent.press(screen.getByTestId('open-w_two')));
    await readDone('w_two');

    expect(entryReadAhead(composition, 'w_two')).toBeUndefined();
  });
});
