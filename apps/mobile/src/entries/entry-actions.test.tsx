import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  openCounterReads,
  openMistakeReports,
  systemRandom,
  type AnyEntryCard,
  type Composition,
  type CounterReads,
  type Haptics,
  type MistakeReports,
} from '@slovo/core';
import {
  createFakeBackend,
  createMemoryContentPort,
  type FakeBackend,
  seedUserState,
} from '@slovo/core/testing';
import { EditionProvider, EntryCard, HapticsProvider, UndoToastProvider } from '@slovo/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { SettingsProvider } from '../settings/settings';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { useEntrySlots } from './entry-actions';

const { config } = activeEditionFiles;

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition = loadEdition(config);

/** The composition the card's actions change, opened afresh for each test. */
let composition: Composition;

/** Whether Mistake Reports are on in effect, as the Edition ships them unless a test turns them off. */
let mistakeReportsOn: boolean;
/** Whether the Knowledge switch is on in effect, as the Edition ships it unless a test turns it off. */
let knowledgeOn: boolean;
/** Whether the Swipe Marks switch is on in effect: off unless a test turns it on. */
let swipeMarksOn: boolean;

/** The Edition in effect: as it ships, with Mistake Reports or the Knowledge switch off when a test turns them off. */
const editionInEffect = (): typeof shippedEdition => ({
  ...shippedEdition,
  isFeatureEnabled: (feature) => {
    if (feature === 'mistakeReports') return mistakeReportsOn;
    if (feature === 'knowledge') return knowledgeOn;
    if (feature === 'swipeMarks') return swipeMarksOn;
    return shippedEdition.isFeatureEnabled(feature);
  },
});

/** The settings as they ship, opened afresh for each test. */
let settings: Awaited<ReturnType<typeof settingsAt>>;

/** The Core's Mistake Reports over a fake backend, opened afresh for each test. */
let mistakeReports: MistakeReports;
let reportsApi: FakeBackend;
/** Mistake Reports as the Shell opens them, when a test makes them fail to open. */
let mockReportsOpening: ReturnType<typeof opened<MistakeReports>> | undefined;
/** The Core's reads of the Community Counters over a fake backend, opened afresh for each test. */
let counterReads: CounterReads;
let countersApi: FakeBackend;

/**
 * The Shell the card draws under: the composition, Mistake Reports and the
 * Community Counters of the test, on a binary that can capture the Share Card.
 */
const shell = () =>
  testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionInEffect()),
    settings,
    mistakeReports: mockReportsOpening ?? opened(mistakeReports),
    counterReads: opened(counterReads),
    shareCard: () => Promise.resolve('closed'),
  });

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
  const userState = await seedUserState();
  composition = await openComposition({
    content: createMemoryContentPort({
      words: [word],
      corrections: [correction],
      idioms: [idiom],
      synonymRows: [row],
      tips: [tip],
    }),
    edition: shippedEdition,
    userState,
    clock,
    random: systemRandom,
  });
  countersApi = createFakeBackend();
  counterReads = openCounterReads({
    edition: shippedEdition,
    backend: countersApi.backend,
    userState,
    clock,
  });
  mistakeReportsOn = true;
  mockReportsOpening = undefined;
  knowledgeOn = true;
  swipeMarksOn = false;
  settings = await settingsAt();
  reportsApi = createFakeBackend();
  mistakeReports = openMistakeReports({
    userState,
    backend: reportsApi.backend,
    edition: shippedEdition,
    appVersion: '0.8.14',
    contentVersion: () => 42,
    clock,
    // The tries again wait for nothing.
    schedule: (run) => {
      run();
      return () => undefined;
    },
    random: systemRandom,
  });
});

/** Lets the composition's writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** An Entry's card as the Feed draws it: its slots, and its side swipes when they are on. */
function SwipedCard({ card, selfCheck = false }: { card: AnyEntryCard; selfCheck?: boolean }) {
  return <EntryCard card={card} slots={useEntrySlots(card)} selfCheck={selfCheck} />;
}

/** Swipes the card sideways by `distance` points and lets it land; a mark takes past 40% of the unmeasured 360 pt card. */
async function swipeBy(distance: number) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('entry-card-side-swipe'), [
      { state: State.BEGAN, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, translationX: Math.sign(distance) * 8, velocityX: 0 },
      { state: State.ACTIVE, translationX: distance, velocityX: 0 },
      { state: State.END, translationX: distance, velocityX: 0 },
    ]);
  });
  await settle();
}

/** The card of the Entry, as the Entry screen a list opens draws it, with its action row. */
async function renderCard(entryId: string): Promise<AnyEntryCard> {
  const card = await composition.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  await renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell()}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <HapticsProvider haptics={haptics}>
            <SettingsProvider>
              <UndoToastProvider>
                <SwipedCard card={card} />
              </UndoToastProvider>
            </SettingsProvider>
          </HapticsProvider>
        </EditionProvider>
      </ShellProvider>
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

    expect(composition.favorites.has(entryId)).toBe(true);
    expect(composition.favorites.list.map((favorite) => favorite.row.title)).toEqual([title]);
  });

  it('files it in a new Collection from the «До колекції» sheet, titled with it', async () => {
    await renderCard(entryId);

    // The card may show the title starting with a capital (owner decision 11).
    const onCard = screen.queryAllByText(title).length;
    await fireEvent.press(screen.getByTestId('collection-button'));
    // The sheet leads with the Entry's title as it is, under the card.
    expect(screen.getAllByText(title)).toHaveLength(onCard + 1);
    await fireEvent.changeText(screen.getByTestId('collection-name'), 'Мої');
    await fireEvent.press(screen.getByTestId('collection-create'));
    await settle();

    const [collection] = composition.collections.list;
    expect(collection?.name).toBe('Мої');
    expect(composition.collections.entries(collection?.id ?? '')).toMatchObject([
      { entryId, row: { title } },
    ]);
  });

  it('marks it Known with «Знаю», and the button shows the mark', async () => {
    await renderCard(entryId);

    await fireEvent.press(screen.getByTestId('knowledge-known'));
    await settle();

    expect(composition.knowledge.state.shown.get(entryId)).toBe('known');
    expect(screen.getByTestId('knowledge-known')).toBeSelected();
  });

  it('keeps «Знаю» and «Не знаю» inactive until Self-check is revealed', async () => {
    const card = await composition.entryCard(entryId);
    if (card === undefined) throw new Error(`No card for ${entryId}`);
    await renderInGestureRoot(
      <SafeAreaProvider initialMetrics={metrics}>
        <ShellProvider shell={shell()}>
          <EditionProvider edition={edition} strings={editionStrings}>
            <HapticsProvider haptics={haptics}>
              <SettingsProvider>
                <UndoToastProvider>
                  <SwipedCard card={card} selfCheck />
                </UndoToastProvider>
              </SettingsProvider>
            </HapticsProvider>
          </EditionProvider>
        </ShellProvider>
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

    expect(composition.hiddenEntries.has(entryId)).toBe(true);
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

    expect(reportsApi.reports.received).toEqual([
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
});

describe('«Повідомити про помилку»', () => {
  const entryId = 'w_test';
  const send = () => screen.getByRole('button', { name: 'Надіслати' });

  /** Reports a typo in the Entry from its flag, with no comment. */
  async function reportTypo() {
    await fireEvent.press(screen.getByRole('button', { name: 'Повідомити про помилку' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Друкарська помилка' }));
    await fireEvent.press(send());
    await settle();
  }

  it('closes the sheet and thanks the reader once the backend took it', async () => {
    await renderCard(entryId);

    await reportTypo();

    expect(reportsApi.reports.received).toHaveLength(1);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Дякуємо! Ми перевіримо.');
    // The sheet slides away under the toast.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Надіслати' })).toBeNull();
    });
  });

  it('thanks the reader at once, before the backend answers', async () => {
    const release = reportsApi.hold();
    await renderCard(entryId);

    await reportTypo();

    expect(reportsApi.reports.received).toEqual([]);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Дякуємо! Ми перевіримо.');
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await settle();
    expect(reportsApi.reports.received).toEqual([
      expect.objectContaining({ entryId, type: 'typo' }),
    ]);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Дякуємо! Ми перевіримо.');
  });

  it('says the report did not go when Mistake Reports fail to open', async () => {
    mockReportsOpening = {
      ...opened(mistakeReports),
      opened: () => Promise.reject(new Error('The queue could not open')),
    };
    await renderCard(entryId);

    await reportTypo();
    await settle();

    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent(
      'Не вдалося надіслати. Спробуй ще раз.',
    );
  });

  it('thanks the reader offline too, and keeps the report to send later', async () => {
    reportsApi.online = false;
    await renderCard(entryId);

    await reportTypo();
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Дякуємо! Ми перевіримо.');
    reportsApi.online = true;
    await act(async () => {
      mistakeReports.foreground();
      await Promise.resolve();
    });
    await settle();

    expect(reportsApi.reports.received).toEqual([
      expect.objectContaining({ entryId, type: 'typo' }),
    ]);
  });

  it('says to try tomorrow over the daily limit', async () => {
    reportsApi.failNext({ reason: 'too-many-requests', retryAfter: 3600 });
    await renderCard(entryId);

    await reportTypo();

    expect(reportsApi.reports.received).toEqual([]);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent(
      'Забагато повідомлень сьогодні. Спробуй завтра.',
    );
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
    mistakeReportsOn = false;
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

  it('shows the zeros of an Entry nobody counted, read as one sentence', async () => {
    await renderCard(entryId);
    await settle();

    expect(line()).toHaveTextContent('Знають 0 з 0 читачів · зберегли 0');
    expect(line()).toHaveAccessibleName('Знають 0 з 0 читачів, зберегли 0');
  });
});

describe('the Community Counters line', () => {
  const entryId = 'w_test';
  const line = () => screen.getByTestId('community-counters');

  it.each([
    [{ known: 1, unknown: 0, saved: 4 }, 'Знають 1 з 1 читача · зберегли 4'],
    [{ known: 1, unknown: 1, saved: 1 }, 'Знають 1 з 2 читачів · зберегли 1'],
    [{ known: 3, unknown: 2, saved: 0 }, 'Знають 3 з 5 читачів · зберегли 0'],
    [{ known: 20, unknown: 1, saved: 7 }, 'Знають 20 з 21 читача · зберегли 7'],
  ])('says %o under the mark buttons as %s', async (counts, text) => {
    countersApi.counters.count(entryId, counts);
    await renderCard(entryId);
    await settle();

    expect(line()).toHaveTextContent(text);
  });

  it('has no line offline with nothing kept', async () => {
    countersApi.failNext('offline');
    await renderCard(entryId);
    await settle();

    expect(screen.getByTestId('knowledge-known')).toBeOnTheScreen();
    expect(screen.queryByTestId('community-counters')).toBeNull();
  });

  it('counts the reader’s own mark and Favorite at once', async () => {
    countersApi.counters.count(entryId, { known: 3, unknown: 2, saved: 0 });
    await renderCard(entryId);
    await settle();

    await fireEvent.press(screen.getByTestId('knowledge-unknown'));
    await settle();
    expect(line()).toHaveTextContent('Знають 3 з 6 читачів · зберегли 0');

    await fireEvent.press(screen.getByTestId('knowledge-known'));
    await fireEvent.press(screen.getByTestId('favorite-button'));
    await settle();
    expect(line()).toHaveTextContent('Знають 4 з 6 читачів · зберегли 1');
    expect(countersApi.counters.asked).toEqual([[entryId]]);
  });

  it('is not read while the Knowledge switch hides it', async () => {
    knowledgeOn = false;
    await renderCard(entryId);
    await settle();

    expect(screen.queryByTestId('knowledge-known')).toBeNull();
    expect(screen.queryByTestId('community-counters')).toBeNull();
    expect(countersApi.counters.asked).toEqual([]);
  });
});

describe('the side swipes of an Entry card (ADR 0077)', () => {
  it('mark the Word Known on a swipe right, in place of the buttons, and the toast undoes it', async () => {
    swipeMarksOn = true;
    await renderCard(word.id);
    expect(screen.queryByTestId('knowledge-known')).not.toBeOnTheScreen();

    await swipeBy(200);

    expect(composition.knowledge.state.shown.get(word.id)).toBe('known');
    expect(screen.getByTestId('swipe-stamp')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    // The mark goes back once the card is home again.
    await waitFor(() => {
      expect(composition.knowledge.state.shown.get(word.id)).toBeUndefined();
    });
  });

  it('mark the Word Unknown on a swipe left', async () => {
    swipeMarksOn = true;
    await renderCard(word.id);

    await swipeBy(-200);

    expect(composition.knowledge.state.shown.get(word.id)).toBe('unknown');
  });

  it.each([
    ['the Swipe Marks switch is off', false, true],
    ['the Knowledge switch is off', true, false],
  ])('are not there while %s', async (_, swipe, knowledge) => {
    swipeMarksOn = swipe;
    knowledgeOn = knowledge;
    await renderCard(word.id);

    expect(screen.queryByTestId('swipe-card')).not.toBeOnTheScreen();
    if (knowledge) expect(screen.getByTestId('knowledge-known')).toBeOnTheScreen();
  });
});

/** The Shell and providers a card draws under. */
function underShell(children: React.ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell()}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <HapticsProvider haptics={haptics}>
            <SettingsProvider>
              <UndoToastProvider>{children}</UndoToastProvider>
            </SettingsProvider>
          </HapticsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>
  );
}

/** An Entry card with the slots the feed gives it. */
function SlottedCard({ card, selfCheck = false }: { card: AnyEntryCard; selfCheck?: boolean }) {
  return <EntryCard card={card} slots={useEntrySlots(card)} selfCheck={selfCheck} />;
}

/** The card of the Entry with the slots the feed gives it. */
async function renderSlotted(entryId: string, selfCheck = false): Promise<AnyEntryCard> {
  const card = await composition.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  await renderInGestureRoot(underShell(<SlottedCard card={card} selfCheck={selfCheck} />));
  return card;
}

/** Lets the given milliseconds pass on the faked timers. */
async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Opens the «⋯» sheet of the card's corner. */
async function openMenu() {
  await fireEvent.press(screen.getByRole('button', { name: 'Більше дій' }));
  await settle();
}

/** Presses an item of the «⋯» sheet. */
async function pressItem(name: string) {
  await fireEvent.press(within(screen.getByTestId('entry-menu')).getByRole('button', { name }));
  await settle();
}

/** Waits for the «⋯» sheet to slide away. */
async function menuGone() {
  await waitFor(() => {
    expect(screen.queryByTestId('entry-menu')).toBeNull();
  });
}

describe('the corner of an Entry card while marks are swiped', () => {
  beforeEach(() => {
    swipeMarksOn = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('has the corner and no action row, Counters line or mark buttons', async () => {
    await renderSlotted('w_test');

    expect(screen.getByTestId('word-corner')).toBeOnTheScreen();
    expect(screen.getByTestId('favorite-button')).toBeOnTheScreen();
    expect(screen.getByTestId('collection-button')).toBeOnTheScreen();
    expect(screen.queryByTestId('word-actions')).toBeNull();
    expect(screen.queryByTestId('community-counters')).toBeNull();
    expect(screen.queryByTestId('knowledge-known')).toBeNull();
  });

  it('keeps the action row while the Swipe Marks switch is off in effect', async () => {
    swipeMarksOn = false;
    await renderSlotted('w_test');

    expect(screen.getByTestId('word-actions')).toBeOnTheScreen();
    expect(screen.getByTestId('knowledge-known')).toBeOnTheScreen();
    expect(screen.queryByTestId('word-corner')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Більше дій' })).toBeNull();
  });

  it('titles the sheet with the Entry and offers «Знаю» and «Не знаю» with no mark', async () => {
    await renderSlotted('w_test');
    await openMenu();

    const menu = within(screen.getByTestId('entry-menu'));
    await waitFor(() => {
      expect(screen.getByTestId('entry-menu-title')).toHaveTextContent(/сло/);
    });
    expect(menu.getByRole('button', { name: 'Знаю' })).toBeOnTheScreen();
    expect(menu.getByRole('button', { name: 'Не знаю' })).toBeOnTheScreen();
    expect(menu.queryByRole('button', { name: 'Зняти позначку' })).toBeNull();
    for (const name of ['Поділитися', 'Сховати', 'Повідомити про помилку', 'Скасувати'])
      expect(menu.getByRole('button', { name })).toBeOnTheScreen();
  });

  it('says «Я й так кажу правильно» for a Correction', async () => {
    await renderSlotted('c_test');
    await openMenu();

    const menu = within(screen.getByTestId('entry-menu'));
    expect(menu.getByRole('button', { name: 'Я й так кажу правильно' })).toBeOnTheScreen();
    expect(menu.queryByRole('button', { name: 'Знаю' })).toBeNull();
  });

  it('marks it Known from the sheet, and a 2.2 s toast says so', async () => {
    await renderSlotted('w_test');
    await openMenu();
    jest.useFakeTimers();
    await pressItem('Знаю');

    expect(composition.knowledge.state.shown.get('w_test')).toBe('known');
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Позначено: знаю');
    await pass(2100);
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Позначено: знаю');
    await pass(100);
    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('changes a Known mark to Unknown, then clears it', async () => {
    await renderSlotted('w_test');
    await openMenu();
    await pressItem('Знаю');
    await menuGone();

    await openMenu();
    const menu = within(screen.getByTestId('entry-menu'));
    expect(menu.queryByRole('button', { name: 'Знаю' })).toBeNull();
    await pressItem('Змінити на «Не знаю»');
    await menuGone();
    expect(composition.knowledge.state.shown.get('w_test')).toBe('unknown');
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Позначено: не знаю');

    await openMenu();
    expect(
      within(screen.getByTestId('entry-menu')).getByRole('button', { name: 'Змінити на «Знаю»' }),
    ).toBeOnTheScreen();
    await pressItem('Зняти позначку');
    expect(composition.knowledge.state.shown.get('w_test')).toBeUndefined();
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Позначку знято');
  });

  it('opens the Share Card once the sheet has slid away', async () => {
    await renderSlotted('w_test');
    await openMenu();
    await fireEvent.press(
      within(screen.getByTestId('entry-menu')).getByRole('button', { name: 'Поділитися' }),
    );
    expect(screen.queryByTestId('share-preview')).toBeNull();
    await menuGone();

    expect(await screen.findByTestId('share-preview')).toBeOnTheScreen();
  });

  it('hides it from the sheet with the hide choice', async () => {
    await renderSlotted('w_test');
    await openMenu();
    await pressItem('Сховати');
    await menuGone();

    expect((await screen.findAllByTestId(/^hide-choice/)).length).toBeGreaterThan(0);
  });

  it('reports a mistake from the sheet', async () => {
    await renderSlotted('w_test');
    await openMenu();
    await pressItem('Повідомити про помилку');
    await menuGone();

    expect(await screen.findByRole('radio', { name: 'Наголос' })).toBeOnTheScreen();
  });

  it('has no mark items on a concealed card', async () => {
    await renderSlotted('w_test', true);
    await openMenu();

    const menu = within(screen.getByTestId('entry-menu'));
    expect(menu.getByRole('button', { name: 'Поділитися' })).toBeOnTheScreen();
    expect(menu.queryByRole('button', { name: 'Знаю' })).toBeNull();
    expect(menu.queryByRole('button', { name: 'Не знаю' })).toBeNull();
  });
});
