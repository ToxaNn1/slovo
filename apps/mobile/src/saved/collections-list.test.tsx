import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { openComposition, systemRandom, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { systemSchedule } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';

import CollectionsScreen from '../app/saved/collections/index';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { editionAtLaunch as edition } from '../edition/edition-at-launch';
import { handDeleteUndo } from './collection-undo';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';
import { layOutSheets } from '../shell/test-render';
import { screenSettled } from '../use-open-screen';

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

const mockPush = jest.fn<(href: string) => void>();

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useRouter: () => ({ back: () => undefined, push: mockPush }),
}));

const strings = editionStrings.collections.screen;

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

/** The device's time, which moves a minute on with each Collection a test makes. */
let now: number;

beforeEach(async () => {
  jest.useFakeTimers();
  mockPush.mockClear();
  now = Date.parse('2026-10-28T09:00:00Z');
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [word('w_kvasha', 'кваша')],
    }),
    edition: loadEdition(activeEditionFiles.config),
    userState: await seedUserState(),
    clock: { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    schedule: systemSchedule,
  });
});

afterEach(() => {
  jest.useRealTimers();
  // A tap opened a screen that no transition settles here: the next test may open one again.
  screenSettled();
});

/** Makes a Collection and answers its id. */
async function collection(name: string) {
  now += 60_000;
  const created = await composition.collections.create(name);
  if (!created.ok) throw new Error(`"${name}" was refused: ${created.reason}`);
  return created.collection.id;
}

/** Lets the sheet's slide and the renders after it finish. */
async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
}

async function renderScreen() {
  await renderApp(<CollectionsScreen />, {
    shell: testShell({
      composition: opened(composition),
      remoteSwitches: switchedTo(edition),
    }),
  });
  await settle();
}

const card = (id: string) => screen.getByTestId(`collection-card-${id}`);

async function voiceOverAction(id: string, actionName: string) {
  await fireEvent(card(id), 'accessibilityAction', { nativeEvent: { actionName } });
  await settle();
}

async function longPress(id: string) {
  await fireEvent(card(id), 'longPress');
  await settle();
}

describe('Collections', () => {
  it('offers the menu to VoiceOver', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    expect(card(autumn)).toHaveProp('accessibilityActions', [
      { name: 'menu', label: 'Дії з колекцією «Осінь»' },
    ]);
    await voiceOverAction(autumn, 'menu');

    expect(screen.getByTestId('collections-menu-rename')).toBeOnTheScreen();
  });

  it('shows the dashed «Нова колекція» card first, then a card for each Collection', async () => {
    const autumn = await collection('Осінь');
    const winter = await collection('Зима');
    await renderScreen();

    expect(screen.getByTestId('collections-add')).toBeOnTheScreen();
    expect(card(winter)).toBeOnTheScreen();
    expect(card(autumn)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Зима, 0 слів' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Осінь, 0 слів' })).toBeOnTheScreen();
  });

  it('opens the Collection from its card', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    await fireEvent.press(card(autumn));

    expect(mockPush).toHaveBeenCalledWith(`/saved/collections/${autumn}`);
  });

  it('makes a new Collection in the name sheet «Нова колекція» opens, and opens it once the sheet has slid away', async () => {
    await collection('Осінь');
    await renderScreen();

    await fireEvent.press(screen.getByTestId('collections-add'));
    await layOutSheets();
    await settle();
    await fireEvent.changeText(screen.getByTestId('collections-name-input'), 'Весна');
    await fireEvent.press(screen.getByTestId('collections-name-submit'));
    // The sheet and its keyboard are still leaving: the Collection's screen, with its toast, waits.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    expect(composition.collections.list.map(({ name }) => name)).toContain('Весна');
    expect(mockPush).not.toHaveBeenCalled();
    await settle();

    const spring = composition.collections.list.find(({ name }) => name === 'Весна');
    if (spring === undefined) throw new Error('«Весна» was not made');
    expect(mockPush).toHaveBeenCalledWith(`/saved/collections/${spring.id}?created=1`);
  });

  it('renames from the menu a long press opens, with a toast once the sheet has slid away', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    await longPress(autumn);
    await layOutSheets();
    await fireEvent.press(screen.getByTestId('collections-menu-rename'));
    // The menu slides away first, then the name sheet slides in.
    await settle();
    await layOutSheets();
    await settle();
    const input = screen.getByTestId('collections-name-input');
    expect(input).toHaveDisplayValue('Осінь');
    await fireEvent.changeText(input, 'Пізня осінь');
    await fireEvent.press(screen.getByTestId('collections-name-submit'));
    // The sheet and its keyboard are still leaving: the toast waits.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByText(editionStrings.collections.toasts.renamed)).not.toBeOnTheScreen();
    await settle();

    expect(screen.getByText('Пізня осінь')).toBeOnTheScreen();
    expect(screen.getByText(editionStrings.collections.toasts.renamed)).toBeOnTheScreen();
    expect(composition.collections.list.map(({ name }) => name)).toEqual(['Пізня осінь']);
  });

  it('says nothing when a rename keeps the name as it is', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    await longPress(autumn);
    await fireEvent.press(screen.getByTestId('collections-menu-rename'));
    await settle();
    await settle();
    await fireEvent.changeText(screen.getByTestId('collections-name-input'), 'Осінь ');
    await fireEvent.press(screen.getByTestId('collections-name-submit'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    await settle();

    expect(screen.queryByTestId('collections-name-input')).not.toBeOnTheScreen();
    expect(screen.queryByText(editionStrings.collections.toasts.renamed)).not.toBeOnTheScreen();
  });

  it('deletes from the menu after the delete sheet, and its undo brings the Collection back', async () => {
    const autumn = await collection('Осінь');
    await composition.collections.add(autumn, 'w_kvasha');
    const before = composition.collections.list;
    await renderScreen();

    await longPress(autumn);
    await fireEvent.press(screen.getByTestId('collections-menu-delete'));
    await settle();
    expect(screen.getByText(strings.confirmDelete.message)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('collections-delete-confirm'));
    await settle();

    expect(composition.collections.list).toEqual([]);
    expect(screen.getByText(editionStrings.collections.toasts.deleted)).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: editionStrings.collections.toasts.undo }),
    );
    await settle();

    expect(composition.collections.list).toEqual(before);
    expect(composition.collections.has(autumn, 'w_kvasha')).toBe(true);
    expect(card(autumn)).toBeOnTheScreen();
  });

  it('offers the undo of a Collection deleted on its own screen', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    await act(async () => {
      const deleted = await composition.collections.delete(autumn);
      if (deleted !== undefined) handDeleteUndo(deleted);
    });
    await settle();
    await fireEvent.press(
      screen.getByRole('button', { name: editionStrings.collections.toasts.undo }),
    );
    await settle();

    expect(composition.collections.list.map(({ id }) => id)).toEqual([autumn]);
    expect(mockPush).toHaveBeenCalledWith(`/saved/collections/${autumn}`);
  });

  it('shows the empty state with no Collections, whose button makes the first one', async () => {
    await renderScreen();

    expect(screen.getByTestId('collections-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('collections-add')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('collections-empty-create'));
    await settle();
    await fireEvent.changeText(screen.getByTestId('collections-name-input'), 'Весна');
    await fireEvent.press(screen.getByTestId('collections-name-submit'));
    await settle();

    expect(composition.collections.list.map(({ name }) => name)).toEqual(['Весна']);
  });
});
