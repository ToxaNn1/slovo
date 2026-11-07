import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fill, pluralCount, type Word } from '@slovo/contracts';
import { HISTORY_CAP, loadEdition, openComposition, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FavoritesScreen from '../app/saved/favorites/index';
import HistoryScreen from '../app/saved/history/index';
import LearningScreen from '../app/saved/learning/index';
import WordOfTheDayArchiveScreen from '../app/saved/words-of-the-day/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';

/** How many times a screen went back. */
let mockBacks = 0;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: () => {
      mockBacks += 1;
    },
    push: () => undefined,
  }),
  Redirect: () => null,
  useIsFocused: () => true,
  useFocusEffect: (effect: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

const count = pluralCount(edition.locale);

/** A Word with its Lemma and nothing else the lists read. */
const word = (id: string, lemma: string): Word => ({
  kind: 'word',
  id,
  lemma,
  stress: [1],
  partOfSpeech: 'adjective',
  primaryDefinition: `The meaning of ${lemma}.`,
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

let composition: Composition;

beforeEach(async () => {
  mockBacks = 0;
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [word('w_quiet', 'сумирний'), word('w_gentle', 'лагідний')],
    }),
    edition: loadEdition(activeEditionFiles.config),
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0 },
  });
});

async function renderScreen(Screen: ComponentType) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({ composition: opened(composition), remoteSwitches: switchedTo(edition) })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <Screen />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('a Saved list screen', () => {
  it('Favorites: the title and how many Entries it holds, spoken in the plural form', async () => {
    await composition.favorites.add('w_quiet');
    await composition.favorites.add('w_gentle');

    await renderScreen(FavoritesScreen);

    const strings = editionStrings.favorites;
    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    const shown = screen.getByTestId('favorites-count');
    expect(shown).toHaveTextContent('2');
    expect(shown).toHaveProp('accessibilityLabel', count(strings.count, 2));
  });

  it('Learning: the title and a count of none while nothing is being learned', async () => {
    await renderScreen(LearningScreen);

    const strings = editionStrings.learning;
    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    const shown = screen.getByTestId('learning-count');
    expect(shown).toHaveTextContent('0');
    expect(shown).toHaveProp('accessibilityLabel', count(strings.count, 0));
  });

  it('History: the title and how many Entries History keeps', async () => {
    await renderScreen(HistoryScreen);

    const strings = editionStrings.history;
    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('history-note')).toHaveTextContent(
      fill(strings.limit, { count: String(HISTORY_CAP) }),
    );
  });

  it('Words of the Day: the title alone', async () => {
    await renderScreen(WordOfTheDayArchiveScreen);

    expect(screen.getByText(editionStrings.wordOfTheDayArchive.title)).toBeOnTheScreen();
    expect(screen.queryByTestId('words-of-the-day-count')).not.toBeOnTheScreen();
  });

  it.each<[string, ComponentType]>([
    ['favorites', FavoritesScreen],
    ['learning', LearningScreen],
    ['history', HistoryScreen],
    ['words-of-the-day', WordOfTheDayArchiveScreen],
  ])('%s: the back link, named after Saved, goes back', async (name, Screen) => {
    await renderScreen(Screen);

    const back = screen.getByTestId(`${name}-back`);
    expect(back).toHaveTextContent(editionStrings.tabs.saved);
    await fireEvent.press(back);
    expect(mockBacks).toBe(1);
  });
});
