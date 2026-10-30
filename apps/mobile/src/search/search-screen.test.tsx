import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import type { Word } from '@slovo/contracts';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import SearchScreen from '../app/search/index';
import { edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

/** The screens the screen pushed, in order. */
const mockPushed: string[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: () => undefined,
    push: (href: string) => {
      mockPushed.push(href);
    },
  }),
}));

const strings = editionStrings.search;

/** A Word with its Lemma, stressed on the given letter, and nothing else Search reads. */
const word = (id: string, lemma: string, stressed: number): Word => ({
  kind: 'word',
  id,
  lemma,
  stress: [stressed],
  partOfSpeech: 'adjective',
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

beforeEach(async () => {
  mockPushed.length = 0;
  // A screen an earlier test opened would hold the next tap.
  screenSettled();
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: [
        word('w_quiet', 'сумирний', 3),
        word('w_sad', 'сумовитий', 3),
        word('w_polite', 'ґречний', 2),
      ],
    }),
    edition: loadEdition(config),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
});

/** Lets the search and the renders after it finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderSearch() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <SearchScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

async function type(query: string) {
  await fireEvent.changeText(screen.getByTestId('search-field'), query);
  await settle();
}

describe('the Search screen', () => {
  it('shows what the query finds, each kind in its group under its chip', async () => {
    await renderSearch();

    await type('сум');

    expect(screen.getByTestId('search-group-words')).toHaveTextContent(strings.groups.words);
    expect(screen.getByTestId('search-result-w_quiet')).toBeOnTheScreen();
    expect(screen.getByTestId('search-result-w_sad')).toBeOnTheScreen();
    expect(screen.queryByTestId('search-result-w_polite')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-group-corrections')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();
  });

  it('reads a result to VoiceOver as its group and its text, without the Stress mark', async () => {
    await renderSearch();

    await type('гре');

    expect(screen.getByTestId('search-group-words')).toHaveAccessibleName(strings.groups.words);
    expect(screen.getByTestId('search-group-words')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('search-result-w_polite')).toHaveAccessibleName('Слова: ґречний');
    await type('сумир');
    expect(screen.getByTestId('search-result-w_quiet')).toHaveAccessibleName('Слова: сумирний');
  });

  it('says «Нічого не знайдено» when nothing matches, and nothing for one letter', async () => {
    await renderSearch();

    await type('жжж');
    expect(screen.getByTestId('search-nothing-found')).toHaveTextContent(strings.nothingFound);

    await type('ж');
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-group-words')).not.toBeOnTheScreen();
  });

  it('announces «Нічого не знайдено» to VoiceOver, which stays in the field while typing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    await renderSearch();

    await type('гре');
    expect(announce).not.toHaveBeenCalled();

    await type('жжж');
    expect(announce).toHaveBeenCalledWith(strings.nothingFound);
  });

  it('opens a result as an Entry card over Search and keeps its query, making nothing Seen', async () => {
    await renderSearch();
    await type('сум');

    await fireEvent.press(screen.getByTestId('search-result-w_sad'));
    await settle();

    expect(mockPushed).toEqual([`/search/w_sad?back=${encodeURIComponent(strings.title)}`]);
    expect(await composition.recentQueries.list()).toEqual(['сум']);
    expect((await composition.openedFromSearch('w_sad'))?.entryId).toBe('w_sad');
    expect(composition.history.list).toEqual([]);
  });

  it('shows «За значенням» from 3 letters: the Words whose Definition holds the query', async () => {
    await renderSearch();

    await type('meaning of ґре');

    expect(screen.getByTestId('search-group-byMeaning')).toHaveTextContent(
      strings.groups.byMeaning,
    );
    expect(screen.getByTestId('search-meaning-w_polite')).toHaveAccessibleName(
      'За значенням: ґречний',
    );
    expect(screen.queryByTestId('search-meaning-w_quiet')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-group-words')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('search-meaning-w_polite'));
    await settle();
    expect(mockPushed).toEqual([`/search/w_polite?back=${encodeURIComponent(strings.title)}`]);
  });

  it('shows no «За значенням» for 2 letters', async () => {
    await renderSearch();

    await type('of');

    expect(screen.queryByTestId('search-group-byMeaning')).not.toBeOnTheScreen();
    expect(screen.getByTestId('search-nothing-found')).toBeOnTheScreen();
  });

  it('shows the recent queries, newest first, while the field is empty', async () => {
    await composition.recentQueries.resultOpened('сум');
    await composition.recentQueries.resultOpened('гре');
    await renderSearch();

    expect(screen.getByTestId('search-recent-0')).toHaveAccessibleName('гре');
    expect(screen.getByTestId('search-recent-1')).toHaveAccessibleName('сум');
    expect(screen.getByTestId('search-recent-clear')).toHaveTextContent(strings.clear);

    await type('сум');
    expect(screen.queryByTestId('search-recent-0')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-recent-clear')).not.toBeOnTheScreen();
  });

  it('runs a recent query on a tap', async () => {
    await composition.recentQueries.resultOpened('гре');
    await renderSearch();

    await fireEvent.press(screen.getByTestId('search-recent-0'));
    await settle();

    expect(screen.getByTestId('search-field')).toHaveDisplayValue('гре');
    expect(screen.getByTestId('search-result-w_polite')).toBeOnTheScreen();
  });

  it('empties the recent queries with «Очистити»', async () => {
    await composition.recentQueries.resultOpened('сум');
    await renderSearch();

    await fireEvent.press(screen.getByTestId('search-recent-clear'));
    await settle();

    expect(screen.queryByTestId('search-recent-0')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-recent-clear')).not.toBeOnTheScreen();
    expect(await composition.recentQueries.list()).toEqual([]);
  });

  it('shows a query kept from an opened result once the field is emptied again', async () => {
    await renderSearch();
    await type('сум');
    await fireEvent.press(screen.getByTestId('search-result-w_sad'));
    await settle();

    await type('');

    expect(screen.getByTestId('search-recent-0')).toHaveAccessibleName('сум');
  });

  it('keeps no query while no result is opened', async () => {
    await renderSearch();

    await type('сум');

    expect(await composition.recentQueries.list()).toEqual([]);
  });
});
