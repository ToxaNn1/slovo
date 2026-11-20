import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import {
  openComposition,
  openMistakeReports,
  systemRandom,
  type AnyEntryCard,
  type Composition,
  type MistakeReports,
} from '@slovo/core';
import {
  createFakeBackend,
  createMemoryContentPort,
  type FakeBackend,
  seedUserState,
  loadEdition,
} from '@slovo/core/testing';
import { EntryCard, UndoToastProvider } from '@slovo/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { activeEditionFiles } from '../edition/edition';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';
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

/** The Edition in effect: as it ships, with Mistake Reports or the Knowledge switch off when a test turns them off. */
const editionInEffect = (): typeof shippedEdition => ({
  ...shippedEdition,
  isFeatureEnabled: (feature) => {
    if (feature === 'mistakeReports') return mistakeReportsOn;
    if (feature === 'knowledge') return knowledgeOn;
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

/**
 * The Shell the card draws under: the composition and Mistake Reports of the
 * test, on a binary that can capture the Share Card.
 */
const shell = () =>
  testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionInEffect()),
    settings,
    mistakeReports: mockReportsOpening ?? opened(mistakeReports),
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
  mistakeReportsOn = true;
  mockReportsOpening = undefined;
  knowledgeOn = true;
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
  await renderApp(
    <UndoToastProvider>
      <SwipedCard card={card} />
    </UndoToastProvider>,
    { shell: shell() },
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
    'Порада: Котра година? Так часто кажуть: Скільки часу? Так правильно: Котра година?',
  ],
])('the corner of %s', (_, entryId, title, shareCardName) => {
  it('shares it from its own Share Card', async () => {
    await renderCard(entryId);

    await openMenu();
    await pressItem('Поділитися');
    await menuGone();

    const preview = within(await screen.findByTestId('share-preview')).getByTestId('share-card');
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
});

describe.each([
  ['a Word', 'w_test'],
  ['a Correction', 'c_test'],
  ['an Idiom', 'i_test'],
  ['a Synonym Row', 'r_walk'],
  ['a Tip', 't_hour'],
])('«Повідомити про помилку» on %s', (_, entryId) => {
  const send = () => screen.getByRole('button', { name: 'Надіслати' });

  it('reports a mistake in it, with no Account, from its «⋯» sheet', async () => {
    await renderCard(entryId);

    await openReport();
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

  /** Reports a typo in the Entry from its «⋯» sheet, with no comment. */
  async function reportTypo() {
    await openReport();
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

    await openReport();
    await fireEvent.press(screen.getByRole('radio', { name: 'Інше' }));
    expect(send()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Коментар (необов’язково)'), 'Приклад хибний');

    expect(send()).toBeEnabled();
  });

  it('has no report item while Mistake Reports are off in effect', async () => {
    mistakeReportsOn = false;
    await renderCard(entryId);
    await openMenu();

    expect(
      within(screen.getByTestId('entry-menu')).queryByRole('button', {
        name: 'Повідомити про помилку',
      }),
    ).toBeNull();
  });
});

describe('the side swipes of an Entry card (ADR 0077)', () => {
  it('mark the Word Known on a swipe right, and the toast undoes it', async () => {
    await renderCard(word.id);

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
    await renderCard(word.id);

    await swipeBy(-200);

    expect(composition.knowledge.state.shown.get(word.id)).toBe('unknown');
  });

  it('are not there while the Knowledge switch is off', async () => {
    knowledgeOn = false;
    await renderCard(word.id);

    expect(screen.queryByTestId('swipe-card')).not.toBeOnTheScreen();
  });
});

/** An Entry card with the slots the feed gives it. */
function SlottedCard({ card, selfCheck = false }: { card: AnyEntryCard; selfCheck?: boolean }) {
  return <EntryCard card={card} slots={useEntrySlots(card)} selfCheck={selfCheck} />;
}

/** The card of the Entry with the slots the feed gives it. */
async function renderSlotted(entryId: string, selfCheck = false): Promise<AnyEntryCard> {
  const card = await composition.entryCard(entryId);
  if (card === undefined) throw new Error(`No card for ${entryId}`);
  await renderApp(
    <UndoToastProvider>
      <SlottedCard card={card} selfCheck={selfCheck} />
    </UndoToastProvider>,
    { shell: shell() },
  );
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

/** Opens the Mistake Report sheet from the «⋯» sheet once it has slid away, and waits for it. */
async function openReport() {
  await openMenu();
  await pressItem('Повідомити про помилку');
  await menuGone();
  await screen.findByRole('button', { name: 'Надіслати' });
}

/** Waits for the «⋯» sheet to slide away. */
async function menuGone() {
  await waitFor(() => {
    expect(screen.queryByTestId('entry-menu')).toBeNull();
  });
}

describe('the corner of an Entry card', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('has the corner with the heart and «До колекції»', async () => {
    await renderSlotted('w_test');

    expect(screen.getByTestId('word-corner')).toBeOnTheScreen();
    expect(screen.getByTestId('favorite-button')).toBeOnTheScreen();
    expect(screen.getByTestId('collection-button')).toBeOnTheScreen();
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
    for (const name of ['Поділитися', 'Не показувати', 'Повідомити про помилку', 'Скасувати'])
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
    expect(screen.getByTestId('undo-toast-message')).toHaveTextContent(
      'Позначено: не знаю. Повторимо завтра',
    );

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
    await pressItem('Не показувати');
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
