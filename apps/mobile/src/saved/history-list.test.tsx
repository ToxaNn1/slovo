import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HistoryScreen from '../app/saved/history';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { Opened } from '../opened';
import { openOnce, type Opening } from '../opening';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const shippedEdition = loadEdition(activeEditionFiles.config);

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** A Word with its Lemma and nothing else History reads. */
const word = (id: string, lemma: string): Word => ({
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
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Словник' }],
  correctionIds: [],
  retired: false,
});

let composition: Composition;

beforeEach(async () => {
  jest.useFakeTimers();
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: [word('w_tykhyi', 'тихий')],
    }),
    edition: shippedEdition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-29T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0 },
  });
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

/**
 * The composition as the app opens it: over another opening, such as the
 * user state, which `dependency` opens, under the gate the app draws History in.
 */
function compositionOver(dependency: () => Promise<void>): Opening<Composition> {
  const userState = openOnce(dependency, { onError: () => undefined });
  return openOnce(
    async () => {
      await userState.opened();
      return composition;
    },
    { onError: () => undefined },
  );
}

/** The History screen under the composition's gate. */
async function renderHistory(opening: Opening<Composition>) {
  const shell = testShell({ composition: opening, remoteSwitches: switchedTo(shippedEdition) });
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <SettingsProvider>
                  <Opened opening={opening} failedTestID="feed-error">
                    <Slot />
                  </Opened>
                </SettingsProvider>
              </EditionProvider>
            </ShellProvider>
          </TokensProvider>
        </SafeAreaProvider>
      ),
      'saved/history/index': HistoryScreen,
    },
    { initialUrl: '/saved/history' },
  );
  await settle();
}

describe('History', () => {
  it('shows the Entries the reader has Seen', async () => {
    await composition.openedFromNotification('w_tykhyi');

    await renderHistory(compositionOver(() => Promise.resolve()));

    expect(screen.getByTestId('history-row-w_tykhyi')).toBeOnTheScreen();
    expect(screen.queryByTestId('history-empty')).not.toBeOnTheScreen();
  });

  it('shows the empty state when nothing is Seen yet', async () => {
    await renderHistory(compositionOver(() => Promise.resolve()));

    expect(screen.getByTestId('history-empty')).toHaveTextContent(
      new RegExp(editionStrings.history.empty.title),
    );
  });

  it('shows the error with a retry, not an endless loader, when what the composition opens over fails', async () => {
    const dependency = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('The database is locked'))
      .mockResolvedValue(undefined);
    await composition.openedFromNotification('w_tykhyi');

    await renderHistory(compositionOver(dependency));

    const error = screen.getByTestId('feed-error');
    expect(screen.queryByTestId('history')).not.toBeOnTheScreen();

    await settle(() => fireEvent.press(within(error).getByText(editionStrings.loadFailed.retry)));

    expect(screen.getByTestId('history-row-w_tykhyi')).toBeOnTheScreen();
  });
});
