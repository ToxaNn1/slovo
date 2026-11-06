import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { loadEdition, openComposition, systemRandom, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, systemSchedule } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CollectionsScreen from '../app/saved/collections/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

const mockPush = jest.fn<(href: string) => void>();

jest.mock('expo-router', () => ({
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

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

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

describe('Collections as cards', () => {
  it('shows each Collection as a card with its name and count', async () => {
    await collection('Осінь');
    await collection('Весна');
    await collection('Зима');
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Зима, 0 записів' })).toBeOnTheScreen();
    expect(screen.getByText('Осінь')).toBeOnTheScreen();
    expect(screen.getAllByText('0 записів')).toHaveLength(3);
  });

  it('opens the Collection on a tap', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    await fireEvent.press(card(autumn));

    expect(mockPush).toHaveBeenCalledWith(`/saved/collections/${autumn}`);
  });

  it('renames from the menu a long press opens, in the field over the cards', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    await longPress(autumn);
    await fireEvent.press(screen.getByTestId('collections-menu-rename'));
    await settle();

    const input = screen.getByTestId('collections-rename-input');
    expect(input).toHaveDisplayValue('Осінь');
    await fireEvent.changeText(input, 'Пізня осінь');
    await fireEvent(input, 'submitEditing');
    await settle();

    expect(screen.queryByTestId('collections-rename')).not.toBeOnTheScreen();
    expect(screen.getByText('Пізня осінь')).toBeOnTheScreen();
    expect(composition.collections.list.map(({ name }) => name)).toEqual(['Пізня осінь']);
  });

  it('deletes from the menu after the confirmation', async () => {
    const autumn = await collection('Осінь');
    const spring = await collection('Весна');
    await renderScreen();

    await longPress(autumn);
    await fireEvent.press(screen.getByTestId('collections-menu-delete'));
    await settle();
    await fireEvent.press(screen.getByTestId('collections-delete-destructive'));
    await settle();

    expect(screen.queryByTestId(`collection-card-${autumn}`)).not.toBeOnTheScreen();
    expect(card(spring)).toBeOnTheScreen();
  });

  it('offers rename, delete and the menu to VoiceOver', async () => {
    const autumn = await collection('Осінь');
    await renderScreen();

    expect(card(autumn)).toHaveProp('accessibilityActions', [
      { name: 'rename', label: 'Перейменувати «Осінь»' },
      { name: 'delete', label: 'Видалити «Осінь»' },
      { name: 'menu', label: 'Дії з колекцією «Осінь»' },
    ]);

    await voiceOverAction(autumn, 'rename');
    expect(screen.getByTestId('collections-rename-input')).toHaveDisplayValue('Осінь');

    await voiceOverAction(autumn, 'delete');
    expect(screen.getByText(`Видалити колекцію «Осінь»?`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('collections-delete-cancel'));
    await settle();

    await voiceOverAction(autumn, 'menu');
    expect(screen.getByTestId('collections-menu-rename')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: strings.menu.delete })).toBeOnTheScreen();
  });
});
