import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadEdition, openComposition, systemRandom, type Composition } from '@slovo/core';
import type { Word } from '@slovo/contracts';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import SearchScreen from '../app/search/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';

const { config } = activeEditionFiles;

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

/** The screens the screen pushed, in order. */
const mockPushed: string[] = [];

/** How many times the screen went back. */
let mockBacks = 0;

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useRouter: () => ({
    back: () => {
      mockBacks += 1;
    },
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

beforeEach(async () => {
  mockPushed.length = 0;
  // A screen an earlier test opened would hold the next tap.
  screenSettled();
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: [
        word('w_quiet', 'сумирний', 3),
        word('w_sad', 'сумовитий', 3),
        word('w_polite', 'ґречний', 2),
      ],
    }),
    edition: loadEdition(config),
    userState: await seedUserState(),
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
  await renderApp(<SearchScreen />, {
    shell: testShell({ composition: opened(composition), remoteSwitches: switchedTo(edition) }),
  });
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

  it('says «Нічого не знайдено» with its hint from 3 letters, and to keep typing below', async () => {
    await renderSearch();

    await type('жжж');
    expect(screen.getByTestId('search-nothing-found')).toHaveTextContent(
      `${strings.nothingFound}${strings.nothingFoundHint}`,
    );
    expect(screen.queryByTestId('search-label')).not.toBeOnTheScreen();

    await type('жж');
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: strings.keepTyping })).toBeOnTheScreen();

    // A Stress mark is no letter, as «За значенням» counts them.
    await type('жж́');
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: strings.keepTyping })).toBeOnTheScreen();

    await type('ж');
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-group-words')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: strings.keepTyping })).toBeOnTheScreen();
  });

  it('says nothing over a longer query until its results come, not the shorter one’s «Продовжуй вводити»', async () => {
    await renderSearch();
    await type('с');
    expect(screen.getByRole('header', { name: strings.keepTyping })).toBeOnTheScreen();
    // The search of the longer query takes its time.
    const search = composition.search.search.bind(composition.search);
    let answer = (): void => undefined;
    jest.spyOn(composition.search, 'search').mockImplementationOnce(
      (query) =>
        new Promise((resolve) => {
          answer = () => {
            resolve(search(query));
          };
        }),
    );

    await type('сум');
    expect(screen.queryByTestId('search-label')).not.toBeOnTheScreen();

    answer();
    await settle();
    expect(screen.getByRole('header', { name: strings.found })).toBeOnTheScreen();
  });

  it('labels what the query finds «Знайдено»', async () => {
    await renderSearch();

    await type('сум');

    expect(screen.getByRole('header', { name: strings.found })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: strings.keepTyping })).not.toBeOnTheScreen();
  });

  it('closes Search with «Скасувати», the field showing «Шукати слово» while empty', async () => {
    mockBacks = 0;
    await renderSearch();

    expect(screen.getByPlaceholderText(strings.inputPlaceholder)).toHaveAccessibleName(
      strings.title,
    );
    await fireEvent.press(screen.getByRole('button', { name: strings.cancel }));

    expect(mockBacks).toBe(1);
  });

  it('announces «Нічого не знайдено» to VoiceOver, which stays in the field while typing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    await renderSearch();

    await type('гре');
    expect(announce).not.toHaveBeenCalled();

    await type('жжж');
    expect(announce).toHaveBeenCalledWith(strings.nothingFound);
  });

  it('opens a result as an Entry card over Search and keeps its query', async () => {
    await renderSearch();
    await type('сум');

    await fireEvent.press(screen.getByTestId('search-result-w_sad'));
    await settle();

    expect(mockPushed).toEqual([`/search/w_sad?back=${encodeURIComponent(strings.title)}`]);
    expect(await composition.recentQueries.list()).toEqual(['сум']);
  });

  it('shows «За значенням» from 3 letters: the Words whose Definition holds the query', async () => {
    await renderSearch();

    await type('meaning of ґре');

    expect(screen.getByTestId('search-group-byMeaning')).toHaveTextContent(
      strings.groups.byMeaning,
    );
    // VoiceOver names the type of the Entry, as in the other groups.
    expect(screen.getByTestId('search-meaning-w_polite')).toHaveAccessibleName('Слова: ґречний');
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
    expect(screen.queryByTestId('search-nothing-found')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: strings.keepTyping })).toBeOnTheScreen();
  });

  it('shows the recent queries, newest first, while the field is empty', async () => {
    await composition.recentQueries.resultOpened('сум');
    await composition.recentQueries.resultOpened('гре');
    await renderSearch();

    expect(screen.getByTestId('search-recent-0')).toHaveAccessibleName('гре');
    expect(screen.getByTestId('search-recent-1')).toHaveAccessibleName('сум');
    expect(screen.getByTestId('search-label-clear')).toHaveTextContent(strings.clear);
    expect(screen.getByRole('header', { name: strings.recent })).toBeOnTheScreen();

    await type('сум');
    expect(screen.queryByTestId('search-recent-0')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-label-clear')).not.toBeOnTheScreen();
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

    await fireEvent.press(screen.getByTestId('search-label-clear'));
    await settle();

    expect(screen.queryByTestId('search-recent-0')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-label-clear')).not.toBeOnTheScreen();
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
