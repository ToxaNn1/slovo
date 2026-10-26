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
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import GameScreen from '../app/game';
import { edition, editionStrings } from '../edition/edition';

/** The Ukrainian Edition with the given Feature Switches turned off. */
function editionWithout(switchedOff: readonly string[]): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      ...Object.fromEntries(switchedOff.map((name) => [name, false])),
    },
  });
}

/** The Edition the screen reads, as it ships unless a test turns a switch off. */
let mockEdition: Edition;

/** The composition the screen reads, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({
  useComposition: () => mockComposition,
  compositionOpening: { opened: () => Promise.resolve(mockComposition) },
}));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
jest.mock('../settings/settings', () => ({
  useSettings: () => ({ current: { hideStreak: false, selfCheck: false } }),
}));
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ navigate: () => undefined, push: () => undefined }),
}));

/** A Word of one Category, with nothing but what the Game reads. */
const word = (index: number): Word => ({
  kind: 'word',
  id: `w_test${String(index)}`,
  lemma: `test${String(index)}`,
  stress: [0],
  partOfSpeech: 'noun',
  primaryDefinition: `The meaning of test${String(index)}.`,
  extraDefinitions: [],
  examples: [],
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

/** Opens the composition over 15 Words, with the given Best results by mode id kept from before. */
async function open({
  best = {},
  switchedOff = [],
}: { best?: Record<string, number>; switchedOff?: readonly string[] } = {}) {
  mockEdition = editionWithout(switchedOff);
  const records = new Map(
    Object.entries(best).map(([modeId, result]) => [`game.best.${modeId}`, JSON.stringify(result)]),
  );
  mockComposition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: Array.from({ length: 15 }, (_, i) => word(i)),
    }),
    edition: mockEdition,
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <GameScreen />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  // The Game plans its offers once the composition is open.
  await waitFor(() => {
    expect(screen.getByTestId('game-mode-guess-word').props['accessibilityState']).toEqual({
      disabled: false,
    });
  });
}

/** The titles over the cards and the mode cards, top to bottom, as VoiceOver meets them. */
function shape(): string[] {
  return within(screen.getByTestId('game-modes'))
    .getAllByRole(/^(header|button)$/)
    .map((node): unknown => node.props['testID'] ?? node.props['children'])
    .map(String);
}

beforeEach(async () => {
  await open();
});

describe('the Game screen', () => {
  it('lists the modes on offer under their groups, in order', async () => {
    await renderScreen();

    expect(shape()).toEqual([
      'Гра',
      'Слова',
      'game-mode-guess-word',
      'Виправлення',
      'game-mode-correction',
    ]);
  });

  it('shows each mode’s own Best result on its card, out of its Round limit', async () => {
    await open({ best: { 'guess-word': 12, correction: 7 } });
    await renderScreen();

    expect(
      within(screen.getByTestId('game-mode-guess-word')).getByText('Найкраще: 12 з 15'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('game-mode-correction')).getByText('Найкраще: 7 з 15'),
    ).toBeTruthy();
    // The line under the title keeps «Вгадай слово»'s Best result.
    expect(screen.getByTestId('game-rules')).toHaveTextContent(/Найкраще — 12 \/ 15\./);
  });

  it('shows no Best result on a mode without a finished Game', async () => {
    await open({ best: { 'guess-word': 12 } });
    await renderScreen();

    expect(within(screen.getByTestId('game-mode-correction')).queryByText(/Найкраще/)).toBeNull();
  });

  it('leaves out a switched-off mode and its group', async () => {
    await open({ switchedOff: ['corrections'] });
    await renderScreen();

    expect(shape()).toEqual(['Гра', 'Слова', 'game-mode-guess-word']);
    expect(screen.queryByText('Виправлення')).toBeNull();
  });
});
