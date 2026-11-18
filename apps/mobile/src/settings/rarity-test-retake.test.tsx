import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Rarity, Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  systemRandom,
  type Composition,
  type Edition,
  type FeatureSwitch,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import MixScreen from '../app/settings/mix';
import RarityTestScreen from '../app/settings/rarity-test';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

/** The UA Edition as it ships, with the Feature Switches given off. */
function editionWithout(...off: FeatureSwitch[]): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      account: 'off',
      ...Object.fromEntries(off.map((feature) => [feature, 'off'])),
    },
  });
}

/** The Edition the shell reads in effect. */
let editionInEffect: Edition;

/** The composition the shell reads, opened afresh for each test. */
let composition: Composition;

jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

const haptics: Haptics = {
  selection: () => undefined,
  impactLight: () => undefined,
  impactMedium: () => undefined,
  success: () => undefined,
  warning: () => undefined,
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const { rarityTest, knowledge } = editionStrings;

/** A Word of the one Category, of the rarity given. */
function word(index: number, rarity: Rarity): Word {
  return {
    kind: 'word',
    id: `w_${String(index)}`,
    lemma: `слово${String(index)}`,
    stress: [1],
    partOfSpeech: 'noun',
    primaryDefinition: `Значення ${String(index)}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'nature',
    rarity,
    sources: [{ title: 'Словник' }],
    correctionIds: [],
    retired: false,
  };
}

/** Two Words of each rarity 1 to 5, so the test asks about 10. */
const words = ([1, 1, 2, 2, 3, 3, 4, 4, 5, 5] as const).map((rarity, index) => word(index, rarity));

/** Lets the Core's reads and writes and the renders after them finish. */
async function settle() {
  for (let turn = 0; turn < 10; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openWith(edition: Edition) {
  editionInEffect = edition;
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words,
    }),
    edition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

/** Settings as the app routes to it, with the Rarity Test and «Мій Мікс» a push away. */
async function renderSettings() {
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionInEffect),
    settings: await settingsAt(),
  });
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <HapticsProvider haptics={haptics}>
                <SettingsProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                </SettingsProvider>
              </HapticsProvider>
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      'settings/index': SettingsScreen,
      'settings/rarity-test': RarityTestScreen,
      'settings/mix': MixScreen,
    },
    { initialUrl: '/settings' },
  );
  await settle();
}

/** Taps a row of Settings and lets the screen it opens draw. */
async function open(row: string) {
  screenSettled();
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${row}`) }));
  await settle();
}

beforeEach(async () => {
  await openWith(editionWithout());
});

describe('Settings › «Рідкість»', () => {
  it('stores the Rarity Range chosen, and the next Feed picks obey it', async () => {
    await renderSettings();
    expect(screen.getByTestId('settings-rarity-bar-5')).toBeSelected();

    await fireEvent.press(screen.getByTestId('settings-rarity-bar-3'));
    await settle();

    expect(composition.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(screen.getByTestId('settings-rarity-bar-3')).toBeSelected();
    const picked: string[] = [];
    for (let turn = 0; turn < 6; turn += 1) {
      const card = await composition.feed.next();
      const id = card !== undefined && 'entryId' in card ? card.entryId : undefined;
      if (id !== undefined) picked.push(id);
    }
    expect(picked.length).toBeGreaterThan(0);
    const rarityOf = new Map(words.map(({ id, rarity }) => [id, rarity]));
    expect(picked.filter((id) => (rarityOf.get(id) ?? 5) > 3)).toEqual([]);
  });

  it('is not in Settings while the rarityCeiling switch is off', async () => {
    await openWith(editionWithout('rarityCeiling'));
    await renderSettings();

    expect(screen.queryByTestId('settings-rarity')).toBeNull();
  });
});

describe('Settings › «Пройти тест ще раз»', () => {
  it('takes the Rarity Test again, and its result overwrites the Rarity Range', async () => {
    await composition.rarityRange.set({ from: 1, to: 4 });
    await renderSettings();

    await open(rarityTest.retake);
    expect(screen.getByText('1 з 10')).toBeOnTheScreen();
    // One stray «Не знаю» of rarity 2; no Word of rarity 4 or 5 is known.
    for (const known of [true, true, false, true, true, true, false, false, false, false]) {
      await fireEvent.press(
        screen.getByRole('button', { name: known ? knowledge.known : knowledge.unknown }),
      );
    }
    await settle();

    expect(
      screen.getByRole('header', {
        name: 'Рідкість тепер від 1 до 3',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('5 з 10 слів знайомі. Змінити рідкість можна в Налаштуваннях.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: rarityTest.done }));
    await settle();
    expect(screen.getByRole('header', { name: editionStrings.settings.title })).toBeOnTheScreen();

    expect(screen.getByTestId('settings-rarity-bar-3')).toBeSelected();
    expect(screen.getByTestId('settings-rarity-bar-4')).not.toBeSelected();
  });

  it('offers the Rarity Test again from its result, drawn anew', async () => {
    await renderSettings();
    await open(rarityTest.retake);
    for (let asked = 0; asked < 10; asked++) {
      await fireEvent.press(screen.getByRole('button', { name: knowledge.known }));
    }
    await settle();

    await fireEvent.press(screen.getByRole('button', { name: rarityTest.again }));
    await settle();

    expect(screen.getByText('1 з 10')).toBeOnTheScreen();
    expect(screen.getByText(rarityTest.question)).toBeOnTheScreen();
  });

  it('leaves the Rarity Range as it was when the reader goes back halfway', async () => {
    await composition.rarityRange.set({ from: 1, to: 4 });
    await renderSettings();
    await open(rarityTest.retake);
    await fireEvent.press(screen.getByRole('button', { name: knowledge.unknown }));

    await fireEvent.press(screen.getByRole('button', { name: editionStrings.settings.title }));
    await settle();

    expect(composition.rarityRange.state).toEqual({ from: 1, to: 4 });
  });

  it.each<[string, FeatureSwitch]>([
    ['the Rarity Test', 'rarityTest'],
    ['the Rarity Range it sets', 'rarityCeiling'],
  ])('is not in Settings while %s is off', async (_, off) => {
    await openWith(editionWithout(off));
    await renderSettings();

    expect(screen.queryByRole('button', { name: new RegExp(rarityTest.retake) })).toBeNull();
  });
});
