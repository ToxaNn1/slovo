import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition, type Haptics } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import HistoryEntryScreen from '../app/saved/history/[entryId]';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import {
  opened,
  recordedAnalytics,
  switchedTo,
  testShell,
  type RecordedAnalytics,
} from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

// The Entry card's action row has its own tests; here it is a stand-in to find on the screen.
jest.mock('./entry-actions', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    EntryActions: () => <View testID="entry-actions" />,
    useKnowledgeButtons: () => null,
  };
});

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition = loadEdition(activeEditionFiles.config);

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

/** A Word of the Edition's first Category, with its Word History when `history` is given. */
function word(id: string, lemma: string, history?: string): Word {
  return {
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
    categoryId: 'emotions-character',
    rarity: 3,
    sources: [{ title: 'Словник' }],
    correctionIds: [],
    retired: false,
    ...(history === undefined ? {} : { history }),
  };
}

/** The Analytics port the composition sends to, afresh for each test. */
let analytics: RecordedAnalytics;
let composition: Composition;

beforeEach(async () => {
  jest.useFakeTimers();
  analytics = recordedAnalytics();
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: [
        word('w_sumyrnyi', 'сумирний', 'Колись означало лише «покірний».'),
        word('w_lahidnyi', 'лагідний'),
      ],
    }),
    edition: shippedEdition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0 },
    analytics: analytics.port,
  });
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

async function settle() {
  await act(async () => {
    await jest.runAllTimersAsync();
  });
}

/** The Entry screen of `entryId`, as a link opens it over the composition, or as `url` opens it. */
async function renderEntry(entryId: string, url = `/entry/${entryId}`) {
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(shippedEdition),
  });
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <SettingsProvider>
                    <Slot />
                  </SettingsProvider>
                </HapticsProvider>
              </EditionProvider>
            </ShellProvider>
          </TokensProvider>
        </SafeAreaProvider>
      ),
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
      'saved/history/[entryId]': HistoryEntryScreen,
    },
    { initialUrl: url },
  );
  await settle();
}

/** The Word History events the port got. */
const historyOpened = () => analytics.events.filter(({ event }) => event === 'wordHistoryOpened');

describe('the Entry screen and the Word History', () => {
  it('tells Analytics the Word History opened once, with the Entry, when the section is drawn', async () => {
    await renderEntry('w_sumyrnyi');

    expect(screen.getByTestId('word-history')).toBeOnTheScreen();
    expect(historyOpened()).toEqual([
      {
        event: 'wordHistoryOpened',
        properties: { entryKind: 'word', rarity: 3, categoryId: 'emotions-character' },
      },
    ]);
  });

  it('tells Analytics nothing of a Word without a Word History', async () => {
    await renderEntry('w_lahidnyi');

    expect(screen.getByTestId('word-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('word-history')).not.toBeOnTheScreen();
    expect(historyOpened()).toEqual([]);
  });
});

describe('the Entry screen of a Word', () => {
  it('keeps the action row docked under the text, out of the scroll, as long as the text runs', async () => {
    await renderEntry('w_sumyrnyi');

    const scroll = screen.getByTestId('entry-scroll');
    expect(within(scroll).getByTestId('word-definition')).toBeOnTheScreen();
    expect(screen.getByTestId('entry-actions')).toBeOnTheScreen();
    expect(within(scroll).queryByTestId('entry-actions')).not.toBeOnTheScreen();
  });
});

describe('an Entry opened from History', () => {
  it('shows the error with a retry when its read fails, and the retry reads it again', async () => {
    jest.spyOn(composition, 'entryCard').mockRejectedValueOnce(new Error('The pack is busy'));

    await renderEntry('w_sumyrnyi', '/saved/history/w_sumyrnyi');

    const error = screen.getByTestId('entry-error');
    expect(within(error).getByText(editionStrings.loadFailed.title)).toBeOnTheScreen();
    expect(screen.getByTestId('entry-back')).toHaveTextContent(editionStrings.history.title);
    expect(screen.queryByTestId('word-card')).not.toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(within(error).getByText(editionStrings.loadFailed.retry));
      await jest.runAllTimersAsync();
    });

    expect(screen.queryByTestId('entry-error')).not.toBeOnTheScreen();
    expect(screen.getByTestId('word-card')).toHaveTextContent(/сумирний/);
  });
});
