import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
  type FeatureSwitch,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import SettingsScreen from '../app/settings';
import MixScreen from '../app/settings/mix';
import RarityTestScreen from '../app/settings/rarity-test';
import { edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';

/** The Ukrainian Edition as it ships, with the Feature Switches given off. */
function editionWithout(...off: FeatureSwitch[]): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      account: false,
      ...Object.fromEntries(off.map((feature) => [feature, false])),
    },
  });
}

/** The Edition the shell reads in effect. */
let mockEdition: Edition;

/** The composition the shell reads, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({ useComposition: () => mockComposition }));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
jest.mock('./settings', () => ({
  useSettings: () => ({
    current: { theme: 'system', fontSize: 'M', hideStreak: false, selfCheck: false },
    update: () => undefined,
  }),
}));
jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const { rarityTest, knowledge } = editionStrings;

/** A Word of the one Category, of the rarity given. */
function word(index: number, rarity: number): Word {
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
    moods: [],
  };
}

/** Two Words of each rarity 1 to 5, so the test asks about 10. */
const words = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5].map((rarity, index) => word(index, rarity));

/** Lets the Core's reads and writes and the renders after them finish. */
async function settle() {
  for (let turn = 0; turn < 10; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openWith(edition: Edition) {
  mockEdition = edition;
  mockComposition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words,
    }),
    edition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

/** Settings as the app routes to it, with the Rarity Test and «Мій Мікс» a push away. */
async function renderSettings() {
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <EditionProvider edition={edition} strings={editionStrings}>
            <Stack screenOptions={{ headerShown: false }} />
          </EditionProvider>
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

describe('Settings › «Пройти тест ще раз»', () => {
  it('takes the Rarity Test again, and its result overwrites the Rarity Floor of the Mix', async () => {
    await mockComposition.mix.setRarityFloor(4);
    await renderSettings();

    await open(rarityTest.retake);
    expect(screen.getByText('1 з 10')).toBeOnTheScreen();
    // Both Words of rarity 1 are known, the first of rarity 2 is not.
    for (const known of [true, true, false, true, true, true, true, true, true, true]) {
      await fireEvent.press(
        screen.getByRole('button', { name: known ? knowledge.known : knowledge.unknown }),
      );
    }
    await settle();

    expect(screen.getByRole('header', { name: 'Ваш рівень: від 2' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: editionStrings.onboarding.mix.next }));
    await settle();
    expect(screen.getByRole('header', { name: editionStrings.settings.title })).toBeOnTheScreen();

    await open(editionStrings.settings.rows.myMix);
    expect(screen.getByTestId('mix-rarity-2')).toBeSelected();
    expect(screen.getByTestId('mix-rarity-4')).not.toBeSelected();
  });

  it('leaves the Rarity Floor as it was when the reader goes back halfway', async () => {
    await mockComposition.mix.setRarityFloor(4);
    await renderSettings();
    await open(rarityTest.retake);
    await fireEvent.press(screen.getByRole('button', { name: knowledge.unknown }));

    await fireEvent.press(screen.getByRole('button', { name: editionStrings.settings.title }));
    await settle();

    expect(mockComposition.mix.state.rarityFloor).toBe(4);
  });

  it.each<[string, FeatureSwitch]>([
    ['the Rarity Test', 'rarityTest'],
    ['the Rarity Floor it sets', 'rarityFloor'],
  ])('is not in Settings while %s is off', async (_, off) => {
    await openWith(editionWithout(off));
    await renderSettings();

    expect(screen.queryByRole('button', { name: new RegExp(rarityTest.retake) })).toBeNull();
  });
});
