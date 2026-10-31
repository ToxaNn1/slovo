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
import { SafeAreaProvider } from 'react-native-safe-area-context';

import WordOfTheDayArchiveScreen from '../app/saved/words-of-the-day/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';

const { config } = activeEditionFiles;

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
  // The screen comes into view as it renders.
  useFocusEffect: (effect: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

const strings = editionStrings.wordOfTheDayArchive;

/** A Word with its Lemma, stressed on the given letter, and nothing else the list reads. */
const word = (id: string, lemma: string, stressed: number, retired = false): Word => ({
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
  retired,
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The archive as kept on each local date, by Word id. */
const kept = (days: Record<string, string>) =>
  new Map(
    Object.entries(days).map(([date, wordId]) => [
      `wordOfTheDayArchive.${date}`,
      JSON.stringify(wordId),
    ]),
  );

async function open(records: Map<string, string>) {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: [
        word('w_quiet', 'сумирний', 3),
        word('w_gentle', 'лагідний', 3),
        word('w_old', 'стародавній', 6, true),
      ],
    }),
    edition: loadEdition(config),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

/** Lets the list's read and the renders after it finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderArchive() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <WordOfTheDayArchiveScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

beforeEach(() => {
  mockPushed.length = 0;
});

describe('the Word of the Day archive screen «Слова дня»', () => {
  it('lists each day newest first as «26 жовтня · сумирний», a Retired Word in its place, read date first', async () => {
    await open(kept({ '2026-10-25': 'w_gentle', '2026-10-27': 'w_quiet', '2026-10-26': 'w_old' }));

    await renderArchive();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^words-of-the-day-row-[\d-]+-open$/);
    expect(rows.map((row) => String(row.props['accessibilityLabel']))).toEqual([
      '27 жовтня, сумирний',
      '26 жовтня, стародавній',
      '25 жовтня, лагідний',
    ]);
    expect(screen.getByTestId('words-of-the-day-row-2026-10-27-open')).toHaveTextContent(
      '27 жовтня · суми́рний',
    );
    expect(screen.queryByTestId('words-of-the-day-empty')).not.toBeOnTheScreen();
  });

  it('opens the Entry of a tapped day', async () => {
    await open(kept({ '2026-10-26': 'w_gentle', '2026-10-27': 'w_quiet' }));
    await renderArchive();

    await fireEvent.press(screen.getByTestId('words-of-the-day-row-2026-10-26-open'));
    await settle();

    expect(mockPushed).toEqual(['/saved/words-of-the-day/w_gentle']);
  });

  it('says so while no day is kept', async () => {
    await open(new Map());

    await renderArchive();

    expect(screen.getByTestId('words-of-the-day-empty')).toHaveTextContent(
      `${strings.empty.title}${strings.empty.message}`,
    );
    expect(screen.queryAllByTestId(/^words-of-the-day-row-/)).toEqual([]);
  });
});
