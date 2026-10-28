import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openCounterReads,
  openMistakeReports,
  openUserState,
  systemRandom,
  type AnyEntryCard,
  type Composition,
  type CounterReads,
  type Haptics,
  type MistakeReports,
} from '@slovo/core';
import {
  createFakeCountersApi,
  createFakeReportsApi,
  createMemoryContentPort,
  type FakeCountersApi,
  type FakeReportsApi,
} from '@slovo/core/testing';
import { EditionProvider, EntryCard, HapticsProvider, UndoToastProvider } from '@slovo/ui';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import { edition, editionStrings } from '../edition/edition';
import { EntryActions } from './entry-actions';

/** The Ukrainian Edition as its config file gives it, every Feature Switch as it ships. */
const mockEdition = loadEdition(config);

/** The composition the card's actions change, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({
  useComposition: () => mockComposition,
  // The sheet's title only; the Collections it lists come from the composition.
  useCompositionRead: () => undefined,
}));
jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
/** Whether Mistake Reports are on in effect, as the Edition ships them unless a test turns them off. */
let mockMistakeReportsOn: boolean;

// The buttons of the action row as the Edition ships them, without the settings and the Mix.
jest.mock('../shown-in-effect', () => ({
  useShown: () => ({
    entryButtons: {
      shareCard: true,
      pronunciation: true,
      knowledge: true,
      mistakeReport: mockMistakeReportsOn,
    },
  }),
}));

/** The Core's Mistake Reports over a fake backend, opened afresh for each test. */
let mockMistakeReports: MistakeReports;
let reportsApi: FakeReportsApi;

jest.mock('../mistake-reports/device-mistake-reports', () => ({
  mistakeReportsOpening: { opened: () => Promise.resolve(mockMistakeReports) },
}));
/** The Core's reads of the Community Counters over a fake backend, opened afresh for each test. */
let mockCounterReads: CounterReads;
let countersApi: FakeCountersApi;

jest.mock('../community-counters/device-counter-reads', () => ({
  counterReadsOpening: { opened: () => Promise.resolve(mockCounterReads) },
}));
// A binary that can capture the Share Card.
jest.mock('../share/device-share', () => ({
  shareCardOnDevice: () => Promise.resolve('closed'),
}));

const word: Word = {
  kind: 'word',
  id: 'w_test',
  lemma: 'слово',
  stress: [2],
  partOfSpeech: 'noun',
  primaryDefinition: 'The meaning of the test Word.',
  extraDefinitions: [],
  examples: [{ text: 'Ось слово тут.' }],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
};

const correction: Correction = {
  kind: 'correction',
  id: 'c_test',
  nonStandardForm: 'хибне',
  correctionType: 'calque',
  standardEquivalents: ['добре'],
  explanation: 'Чому добре краще.',
  examplePair: { nonStandard: 'Тут хибне.', standard: 'Тут добре.' },
  categoryId: 'everyday',
  sources: [{ title: 'Test source' }],
  literaryUses: [],
  retired: false,
};

const idiom: Idiom = {
  kind: 'idiom',
  id: 'i_test',
  expression: 'бити байдики',
  idiomType: 'idiom',
  primaryDefinition: 'Ледарювати.',
  extraDefinitions: [],
  examples: [],
  sources: [{ title: 'Test source' }],
  retired: false,
};

const row: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_walk',
  dominant: { text: 'іти', stress: [2] },
  meaning: 'Рухатися пішки.',
  members: ['простувати', 'чимчикувати', 'шкандибати', 'дибати', 'чалапати'].map((text) => ({
    text,
    stress: [0],
  })),
  sources: [{ title: 'Словник синонімів' }],
  retired: false,
};

const tip: Tip = {
  kind: 'tip',
  id: 't_hour',
  title: 'Котра година?',
  nonStandardForm: 'Скільки часу?',
  standardForm: 'Котра година?',
  explanation: 'Час не рахують, а питають, котра година.',
  sources: [{ title: 'Антоненко-Давидович. Як ми говоримо' }],
  gameQuestion: {
    prompt: 'Як спитати?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['A', 'B', 'C'],
  },
  retired: false,
};

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

const clock = { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

beforeEach(async () => {
  const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
  mockComposition = await openComposition({
    content: createMemoryContentPort({
      words: [word],
      corrections: [correction],
      idioms: [idiom],
      synonymRows: [row],
      tips: [tip],
    }),
    edition: mockEdition,
    userState,
    clock,
    random: systemRandom,
  });
  countersApi = createFakeCountersApi();
  mockCounterReads = openCounterReads({ edition: mockEdition, api: countersApi, userState, clock });
  mockMistakeReportsOn = true;
  reportsApi = createFakeReportsApi();
  mockMistakeReports = openMistakeReports({
    userState,
    api: reportsApi,
    edition: mockEdition,
    appVersion: '0.8.14',
    contentVersion: 42,
    clock,
    // A report the backend takes at once waits for nothing.
    schedule: () => () => undefined,
    random: systemRandom,
  });
});

/** Lets the composition's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** The card of the Entry, as the Entry screen a list opens draws it, with its action row. */
async function renderCard(entryId: string): Promise<AnyEntryCard> {
  const card = await mockComposition.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <HapticsProvider haptics={haptics}>
          <UndoToastProvider>
            <EntryCard card={card} actions={<EntryActions card={card} />} />
          </UndoToastProvider>
        </HapticsProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return card;
}

describe.each([
  [
    'a Synonym Row',
    'r_walk',
    'іти́',
    'іти, синонімічний ряд: простувати, чимчикувати, шкандибати, дибати, чалапати. Рухатися пішки.',
  ],
  [
    'a Tip',
    't_hour',
    'Котра година?',
    'Порада: Котра година? Так часто кажуть: Скільки часу? Українською краще: Котра година?',
  ],
])('the action row of %s', (_, entryId, title, shareCardName) => {
  it('shares it from its own Share Card', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('share-button'));

    const preview = within(screen.getByTestId('share-preview')).getByTestId('share-card');
    expect(preview).toHaveAccessibleName(shareCardName);
  });

  it('keeps it in Favorites, where its row leads with its title', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('favorite-button'));
    await settle();

    expect(mockComposition.favorites.has(entryId)).toBe(true);
    expect(mockComposition.favorites.list.map((favorite) => favorite.row.title)).toEqual([title]);
  });

  it('files it in a new Collection from the «До колекції» sheet', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('collection-button'));
    await fireEvent.changeText(screen.getByTestId('collection-name'), 'Мої');
    await fireEvent.press(screen.getByTestId('collection-create'));
    await settle();

    const [collection] = mockComposition.collections.list;
    expect(collection?.name).toBe('Мої');
    expect(mockComposition.collections.entries(collection?.id ?? '')).toMatchObject([
      { entryId, row: { title } },
    ]);
  });

  it('marks it Known with «Знаю», and the button shows the mark', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('knowledge-known'));
    await settle();

    expect(mockComposition.knowledge.state.shown.get(entryId)).toBe('known');
    expect(screen.getByTestId('knowledge-known')).toBeSelected();
  });

  it('keeps «Знаю» and «Не знаю» inactive until Self-check is revealed', async () => {
    const card = await mockComposition.entryCard(entryId);
    if (card === undefined) throw new Error(`No card for ${entryId}`);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <HapticsProvider haptics={haptics}>
            <UndoToastProvider>
              <EntryCard card={card} actions={<EntryActions card={card} />} selfCheck />
            </UndoToastProvider>
          </HapticsProvider>
        </EditionProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('knowledge-unknown')).toBeDisabled();
    await fireEvent.press(screen.getByTestId(`${card.kind}-reveal`));
    expect(screen.getByTestId('knowledge-unknown')).toBeEnabled();
  });

  it('hides it from its card, and the toast says so', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('hide-button'));
    await settle();
    expect(screen.getByTestId('hide-choice-whole-kind')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('hide-choice-entry'));
    await settle();

    expect(mockComposition.hiddenEntries.has(entryId)).toBe(true);
    expect(screen.getByText(`«${title}» приховано`)).toBeOnTheScreen();
  });
});

describe.each([
  ['a Word', 'w_test'],
  ['a Correction', 'c_test'],
  ['an Idiom', 'i_test'],
  ['a Synonym Row', 'r_walk'],
  ['a Tip', 't_hour'],
])('«Повідомити про помилку» on %s', (_, entryId) => {
  const send = () => screen.getByRole('button', { name: 'Надіслати' });

  it('reports a mistake in it, with no Account, from the flag of its action row', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByRole('button', { name: 'Повідомити про помилку' }));
    expect(send()).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Наголос' }));
    await fireEvent.changeText(
      screen.getByLabelText('Коментар (необов’язково)'),
      ' Наголос на першому. ',
    );
    await fireEvent.press(send());
    await settle();

    expect(reportsApi.received).toEqual([
      {
        editionId: 'uk',
        entryId,
        type: 'stress',
        comment: 'Наголос на першому.',
        appVersion: '0.8.14',
        contentVersion: 42,
      },
    ]);
  });

  it('keeps «Надіслати» disabled for «Інше» until the comment says something', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByRole('button', { name: 'Повідомити про помилку' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Інше' }));
    expect(send()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Коментар (необов’язково)'), 'Приклад хибний');

    expect(send()).toBeEnabled();
  });

  it('has no flag while Mistake Reports are off in effect', async () => {
    mockMistakeReportsOn = false;
    await renderCard(entryId);

    expect(screen.getByTestId('favorite-button')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Повідомити про помилку' })).toBeNull();
  });
});

describe.each([
  ['a Word', 'w_test'],
  ['a Correction', 'c_test'],
  ['an Idiom', 'i_test'],
  ['a Synonym Row', 'r_walk'],
  ['a Tip', 't_hour'],
])('the Community Counters line on %s', (_, entryId) => {
  const line = () => screen.getByTestId('community-counters');

  it.each([
    [{ known: 1, unknown: 0, saved: 4 }, 'Знають 1 з 1 читача · зберегли 4'],
    [{ known: 1, unknown: 1, saved: 1 }, 'Знають 1 з 2 читачів · зберегли 1'],
    [{ known: 3, unknown: 2, saved: 0 }, 'Знають 3 з 5 читачів · зберегли 0'],
    [{ known: 20, unknown: 1, saved: 7 }, 'Знають 20 з 21 читача · зберегли 7'],
  ])('says %o under the mark buttons as %s', async (counts, text) => {
    countersApi.count(entryId, counts);
    await renderCard(entryId);
    await settle();

    expect(line()).toHaveTextContent(text);
  });

  it('shows the zeros of an Entry nobody counted, read as one sentence', async () => {
    await renderCard(entryId);
    await settle();

    expect(line()).toHaveTextContent('Знають 0 з 0 читачів · зберегли 0');
    expect(line()).toHaveAccessibleName('Знають 0 з 0 читачів, зберегли 0');
  });

  it('has no line offline with nothing kept', async () => {
    countersApi.fail('offline');
    await renderCard(entryId);
    await settle();

    expect(screen.getByTestId('knowledge-known')).toBeOnTheScreen();
    expect(screen.queryByTestId('community-counters')).toBeNull();
  });

  it('counts the reader’s own mark and Favorite at once', async () => {
    countersApi.count(entryId, { known: 3, unknown: 2, saved: 0 });
    await renderCard(entryId);
    await settle();

    await fireEvent.press(screen.getByTestId('knowledge-unknown'));
    await settle();
    expect(line()).toHaveTextContent('Знають 3 з 6 читачів · зберегли 0');

    await fireEvent.press(screen.getByTestId('knowledge-known'));
    await fireEvent.press(screen.getByTestId('favorite-button'));
    await settle();
    expect(line()).toHaveTextContent('Знають 4 з 6 читачів · зберегли 1');
    expect(countersApi.asked).toEqual([[entryId]]);
  });
});
