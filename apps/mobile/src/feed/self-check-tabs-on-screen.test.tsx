import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

/** The UA Edition in effect, with `calligraphy` as the test sets it. */
let editionInEffect: Edition;

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

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

/** A Word of the Edition's first Category, with the Stress on its second letter. */
function word(id: string, lemma: string, more: Partial<Word> = {}): Word {
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
    ...more,
  };
}

/** A Correction with every tab filled. */
const correction: Correction = {
  kind: 'correction',
  id: 'c_slidujuchyi',
  nonStandardForm: 'слідуючий',
  correctionType: 'russianism',
  standardEquivalents: ['наступний', 'другий'],
  explanation: 'Дієприкметник на -учий не властивий українській мові.',
  examplePair: { nonStandard: 'Слідуючий тиждень.', standard: 'Наступний тиждень.' },
  categoryId: 'everyday',
  sources: [{ title: 'Словник' }],
  literaryUses: [],
  retired: false,
};

/** An Idiom with every tab filled. */
const idiom: Idiom = {
  kind: 'idiom',
  id: 'i_bytybaidyky',
  expression: 'бити байдики',
  idiomType: 'idiom',
  primaryDefinition: 'Ледарювати.',
  extraDefinitions: [],
  examples: [{ text: 'Годі бити байдики!', author: 'Марко Вовчок' }],
  etymology: 'Байдики — дрібні тріски.',
  sources: [{ title: 'Словник фразеологізмів' }],
  retired: false,
};

/** A Tip with an Example: one tab, «Правило», so its card draws no tab bar (ADR 0119). */
const tip: Tip = {
  kind: 'tip',
  id: 't_hour',
  title: 'Котра година?',
  nonStandardForm: 'Скільки часу?',
  standardForm: 'Котра година?',
  explanation: 'Час не рахують, а питають, котра година.',
  example: { text: 'Перепрошую, котра година?' },
  sources: [{ title: 'Антоненко-Давидович. Як ми говоримо' }],
  gameQuestion: {
    prompt: 'Як спитати?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['A', 'B', 'C'],
  },
  retired: false,
};

/** A Synonym Row, which draws no tab bar (ADR 0091). */
const row: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_walk',
  dominant: { text: 'іти', stress: [2] },
  meaning: 'Рухатися пішки.',
  members: ['простувати', 'чимчикувати'].map((text) => ({ text, stress: [0] })),
  sources: [{ title: 'Словник синонімів' }],
  retired: false,
};

/** The Entries besides the Word of the Day each case puts in the Feed. */
interface Content {
  readonly words?: readonly Word[];
  readonly corrections?: readonly Correction[];
  readonly idioms?: readonly Idiom[];
  readonly tips?: readonly Tip[];
  readonly synonymRows?: readonly SynonymRow[];
}

/** Opens the composition over the Word of the Day and `content`, `wordTabs` on, Self-check on or off. */
async function open(content: Content, selfCheck: boolean) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      // Self-check's switch is on, as in an Edition that keeps it; the UA Edition turns it off (owner 08.11).
      feature === 'wordTabs' ||
      feature === 'tips' ||
      feature === 'synonymRows' ||
      feature === 'selfCheck'
        ? true
        : // No later question takes the Word of the Day's place in the Feed.
          feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature),
  };
  // Onboarding finished weeks ago and the gestures hint was shown: nothing covers the Feed.
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z', gesturesHintShown: true, selfCheck },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      correctionCategories: [
        { id: 'everyday', displayName: 'Щодня', description: 'Щодня.', tone: 'loud' },
      ],
      words: [word('w_lahidnyi', 'лагідний'), ...(content.words ?? [])],
      corrections: content.corrections ?? [],
      idioms: content.idioms ?? [],
      tips: content.tips ?? [],
      synonymRows: content.synonymRows ?? [],
    }),
    edition: editionInEffect,
    userState: userState,
    clock,
    // The first Entry in each draw, so each opening shows the same Word of the Day.
    random: { next: () => 0 },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
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

/** The Shell the app draws under: the settings and the composition over the test's user state. */
const shell = () =>
  testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });

/** The app on the Feed. */
async function renderApp() {
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell()}>
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
      index: HomeScreen,
    },
    { initialUrl: '/' },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

const hidden = { includeHiddenElements: true };

/** How far a pan moves before the Feed's swipe takes it. */
const ACTIVATION = 12;

/** One swipe up from the Word of the Day, which brings the other Word's card on screen. */
async function swipeUp() {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
    await jest.advanceTimersByTimeAsync(500);
  });
}

/** The card of `kind` besides the Word of the Day. */
function cardOf(kind: string) {
  const card = screen
    .queryAllByTestId(`${kind}-card`, hidden)
    .find(
      (each) =>
        within(each).queryByTestId('word-of-the-day-badge', hidden) === null &&
        within(each).queryByTestId('word-of-the-day-kicker', hidden) === null,
    );
  if (card === undefined) throw new Error(`No ${kind} card besides the Word of the Day`);
  return within(card);
}

/** The tabs of a card by their names, with whether each is selected and whether it is disabled. */
function tabsOf(card: ReturnType<typeof cardOf>) {
  const selected = card.queryAllByRole('tab', { ...hidden, selected: true });
  const disabled = card.queryAllByRole('tab', { ...hidden, disabled: true });
  return card.queryAllByRole('tab', hidden).map((tab) => ({
    name: String(tab.props['accessibilityLabel']),
    selected: selected.includes(tab),
    disabled: disabled.includes(tab),
  }));
}

/** The tabs as `names` give them, the first selected, all disabled or all enabled. */
function tabs(names: readonly string[], disabled: boolean) {
  return names.map((name, at) => ({ name, selected: at === 0, disabled }));
}

/** A Word with every tab filled: Examples, links, more meanings and an etymology. */
const fullWord = word('w_sumyrnyi', 'сумирний', {
  examples: [{ text: 'Сумирний кінь стояв тихо.', author: 'Іван Франко' }],
  synonyms: ['тихий'],
  antonyms: ['буйний'],
  extraDefinitions: ['Покірний.', 'Миролюбний.'],
  etymology: 'Від «мир».',
});

const cases: readonly {
  readonly kind: string;
  readonly content: Content;
  readonly names: readonly string[];
  /** A text of the first tab, which only the reveal shows. */
  readonly answer: string;
}[] = [
  {
    kind: 'word',
    content: { words: [fullWord] },
    names: ['Суть', 'Приклад', 'Зв’язки', 'Історія', 'Джерело'],
    answer: 'Значення слова сумирний.',
  },
  {
    kind: 'correction',
    content: { corrections: [correction] },
    names: ['Як краще', 'Чому', 'Приклади', 'Джерело'],
    answer: 'наступний',
  },
  {
    kind: 'idiom',
    content: { idioms: [idiom] },
    names: ['Суть', 'Звідки', 'Приклад', 'Джерело'],
    answer: 'Ледарювати.',
  },
  {
    kind: 'tip',
    content: { tips: [tip] },
    names: ['Правило', 'Джерело'],
    answer: 'Час не рахують, а питають, котра година.',
  },
];

describe('Self-check on the tabs of an Entry card in the Feed', () => {
  it.each(cases)(
    'draws the tabs of a $kind card disabled until the reveal, enabled after it',
    async ({ kind, content, names, answer }) => {
      await open(content, true);
      await renderApp();
      await swipeUp();

      expect(tabsOf(cardOf(kind))).toEqual(tabs(names, true));
      expect(cardOf(kind).queryByText(answer, { ...hidden, exact: false })).toBeNull();

      await settle(() => fireEvent.press(cardOf(kind).getByTestId(`${kind}-reveal`, hidden)));

      expect(tabsOf(cardOf(kind))).toEqual(tabs(names, false));
      expect(cardOf(kind).getAllByText(answer, { ...hidden, exact: false }).length).toBeGreaterThan(
        0,
      );
    },
  );

  it.each(cases)(
    'draws the tabs of a $kind card enabled at once with Self-check off',
    async ({ kind, content, names }) => {
      await open(content, false);
      await renderApp();
      await swipeUp();

      expect(tabsOf(cardOf(kind))).toEqual(tabs(names, false));
      expect(cardOf(kind).queryByTestId(`${kind}-reveal`, hidden)).toBeNull();
    },
  );

  it('draws no tabs on a Synonym Row card before the reveal, its page and «Джерело» after it', async () => {
    await open({ synonymRows: [row] }, true);
    await renderApp();
    await swipeUp();

    expect(tabsOf(cardOf('synonymRow'))).toEqual([]);
    expect(cardOf('synonymRow').queryByText('Рухатися пішки.', hidden)).toBeNull();

    await settle(() =>
      fireEvent.press(cardOf('synonymRow').getByTestId('synonymRow-reveal', hidden)),
    );

    expect(tabsOf(cardOf('synonymRow'))).toEqual(tabs(['Ряд · 1/1', 'Джерело'], false));
    expect(cardOf('synonymRow').getByText('Рухатися пішки.', hidden)).toBeTruthy();
  });
});
