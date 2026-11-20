import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { Slot } from 'expo-router';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import HistoryScreen from '../app/saved/history';
import { activeEditionFiles, editionStrings, editionTokens } from '../edition/edition';
import { Opened } from '../opened';
import { openOnce, type Opening } from '../opening';
import { switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const shippedEdition = loadEdition(activeEditionFiles.config);

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
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
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
  await renderApp(
    {
      _layout: () => (
        <Opened opening={opening} failedTestID="feed-error">
          <Slot />
        </Opened>
      ),
      'saved/history/index': HistoryScreen,
    },
    { shell, initialUrl: '/saved/history' },
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

  it('lists every day in one list, newest first, each row with its meaning and its day on a chip', async () => {
    jest.setSystemTime(new Date('2026-10-29T10:00:00Z'));
    composition = await openComposition({
      content: createMemoryContentPort({
        categories: [
          { id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' },
        ],
        words: [word('w_tykhyi', 'тихий'), word('w_lahidnyi', 'лагідний')],
      }),
      edition: shippedEdition,
      userState: await seedUserState({
        history: {
          w_tykhyi: { seenAt: '2026-10-20T08:00:00.000Z', wordOfTheDay: false },
          w_lahidnyi: { seenAt: '2026-10-29T08:00:00.000Z', wordOfTheDay: true },
        },
      }),
      clock: { now: () => new Date('2026-10-29T10:00:00Z'), timeZone: () => 'Europe/Kyiv' },
      random: { next: () => 0 },
    });

    await renderHistory(compositionOver(() => Promise.resolve()));

    const rows = screen.getAllByTestId(/^history-row-\w+-open$/);
    expect(rows.map((row) => String(row.props['accessibilityLabel']))).toEqual([
      'лагідний, Значення слова лагідний., сьогодні',
      'тихий, Значення слова тихий., 20 жовт.',
    ]);
    // No day headings and no kind label: the chip says the day.
    expect(screen.queryByText(editionStrings.history.days.today)).not.toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(editionStrings.history.kinds.wordOfTheDay))).toBeNull();
    expect(screen.getByTestId('history-row-w_lahidnyi-day')).toHaveStyle({
      backgroundColor: editionTokens.colors.light.accent,
    });
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

  it('draws the rows near the screen and not the whole of a long History', async () => {
    const ids = Array.from({ length: 120 }, (_, at) => `w_${String(at).padStart(3, '0')}`);
    composition = await openComposition({
      content: createMemoryContentPort({
        categories: [
          { id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' },
        ],
        words: ids.map((id) => word(id, id)),
      }),
      edition: shippedEdition,
      userState: await seedUserState({
        history: Object.fromEntries(
          ids.map((id) => [id, { seenAt: '2026-10-20T08:00:00.000Z', wordOfTheDay: false }]),
        ),
      }),
      clock: { now: () => new Date('2026-10-29T10:00:00Z'), timeZone: () => 'Europe/Kyiv' },
      random: { next: () => 0 },
    });
    await renderHistory(compositionOver(() => Promise.resolve()));
    const drawn = () => screen.queryAllByTestId(/^history-row-w_\d+-open$/).length;
    const list = screen.getByTestId('history');

    // The screen lays the list out, 844 points high, each row 80 points.
    await settle(async () => {
      await fireEvent(list, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
      await fireEvent(list, 'contentSizeChange', 390, ids.length * 80);
    });
    // Each drawn row's cell lays out 80 points high, in its place; the list draws the next batch.
    const laidOut = new Set<string>();
    for (let round = 0; round < 20; round += 1) {
      const fresh = ids.filter(
        (id) => !laidOut.has(id) && screen.queryByTestId(`history-row-${id}`),
      );
      if (fresh.length === 0) break;
      await settle(async () => {
        for (const id of fresh) {
          let cell = screen.getByTestId(`history-row-${id}`).parent;
          while (cell !== null && typeof cell.props['onLayout'] !== 'function') cell = cell.parent;
          if (cell === null) continue;
          const y = ids.indexOf(id) * 80;
          await fireEvent(cell, 'layout', {
            nativeEvent: { layout: { x: 0, y, width: 390, height: 80 } },
          });
          laidOut.add(id);
        }
        await fireEvent.scroll(list, {
          nativeEvent: {
            contentOffset: { x: 0, y: 0 },
            contentSize: { width: 390, height: ids.length * 80 },
            layoutMeasurement: { width: 390, height: 844 },
          },
        });
      });
    }

    // About seven screens of rows (844 / 80 × 7 ≈ 74 at most), not all 120: half the list or less.
    expect(drawn()).toBeGreaterThan(10);
    expect(drawn()).toBeLessThanOrEqual(ids.length / 2);
  });
});
