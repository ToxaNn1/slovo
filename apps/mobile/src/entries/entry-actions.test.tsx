import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SynonymRow, Tip } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type AnyEntryCard,
  type Composition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, EntryCard, HapticsProvider, UndoToastProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import { edition, editionStrings } from '../edition/edition';
import { EntryActions } from './entry-actions';

/** The Ukrainian Edition as its config file gives it, every Feature Switch as it ships. */
const mockEdition = loadEdition(config);

/** The composition the card's actions change, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({
  useComposition: () => mockComposition,
  // The sheet's title only; the Collections it lists come from the composition.
  useCompositionRead: () => undefined,
}));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));

const row: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_walk',
  dominant: { text: 'іти', stress: [2] },
  meaning: 'Рухатися пішки.',
  members: ['простувати', 'чимчикувати', 'шкандибати', 'дибати', 'чалапати'].map((text) => ({
    text,
    stress: [0],
  })),
  sources: [{ title: 'Словник синонімів' }],
  retired: false,
};

const tip: Tip = {
  kind: 'tip',
  id: 't_hour',
  title: 'Котра година?',
  nonStandardForm: 'Скільки часу?',
  standardForm: 'Котра година?',
  explanation: 'Час не рахують, а питають, котра година.',
  sources: [{ title: 'Антоненко-Давидович. Як ми говоримо' }],
  gameQuestion: {
    prompt: 'Як спитати?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['A', 'B', 'C'],
  },
  retired: false,
};

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

beforeEach(async () => {
  mockComposition = await openComposition({
    content: createMemoryContentPort({ synonymRows: [row], tips: [tip] }),
    edition: mockEdition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
});

/** Lets the composition's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** The card of the Entry, as the Entry screen a list opens draws it, with its action row. */
async function renderCard(entryId: string): Promise<AnyEntryCard> {
  const card = await mockComposition.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <HapticsProvider haptics={haptics}>
          <UndoToastProvider>
            <EntryCard card={card} actions={<EntryActions card={card} />} />
          </UndoToastProvider>
        </HapticsProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return card;
}

describe.each([
  ['a Synonym Row', 'r_walk', 'іти́'],
  ['a Tip', 't_hour', 'Котра година?'],
])('the action row of %s', (_, entryId, title) => {
  it('keeps it in Favorites, where its row leads with its title', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('favorite-button'));
    await settle();

    expect(mockComposition.favorites.has(entryId)).toBe(true);
    expect(mockComposition.favorites.list.map((favorite) => favorite.row.title)).toEqual([title]);
  });

  it('files it in a new Collection from the «До колекції» sheet', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('collection-button'));
    await fireEvent.changeText(screen.getByTestId('collection-name'), 'Мої');
    await fireEvent.press(screen.getByTestId('collection-create'));
    await settle();

    const [collection] = mockComposition.collections.list;
    expect(collection?.name).toBe('Мої');
    expect(mockComposition.collections.entries(collection?.id ?? '')).toMatchObject([
      { entryId, row: { title } },
    ]);
  });
});
