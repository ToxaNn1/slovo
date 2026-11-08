import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { FontSize, Idiom, Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, FontSizeProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { entryCardFrame, fontSizeSteps } from '@slovo/ui/tokens';
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

/**
 * Opens the composition over the Word of the Day and `second`, with `wordTabs`
 * on or off, and with `idioms` when the test reads an Idiom card.
 */
async function open(second: Word, wordTabs = true, idioms: readonly Idiom[] = []) {
  const shipped = loadEdition(config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'wordTabs'
        ? wordTabs
        : // No later question takes the Word of the Day's place in the Feed.
          feature !== 'laterQuestions' && shipped.isFeatureEnabled(feature),
  };
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  // The gestures hint was shown on an earlier launch: its finger demo loops for as long as
  // the sheet is open, which settling every timer would never finish. It has its own test.
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z', gesturesHintShown: true },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [second, word('w_lahidnyi', 'лагідний')],
      idioms,
    }),
    edition: editionInEffect,
    userState: userState,
    clock,
    // The first Word in each draw, so each opening shows the same Word of the Day.
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

/** The app on the Feed, at the user's font size. */
async function renderApp(fontSize: FontSize = 'M') {
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell()}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <SettingsProvider>
                    <FontSizeProvider fontSize={fontSize}>
                      <Slot />
                    </FontSizeProvider>
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

/** The card of the Word that is not the Word of the Day: the one drawn in tabs. */
function wordCard() {
  const card = screen
    .getAllByTestId('word-card', hidden)
    .find((each) => within(each).queryByTestId('word-of-the-day-badge', hidden) === null);
  if (card === undefined) throw new Error('No Word card besides the Word of the Day');
  return within(card);
}

/** The tabs of the Word card, by their names, with whether each is selected. */
function tabsOf(card: ReturnType<typeof wordCard>) {
  const selected = card.queryAllByRole('tab', { ...hidden, selected: true });
  return card.queryAllByRole('tab', hidden).map((tab) => ({
    name: String(tab.props['accessibilityLabel']),
    selected: selected.includes(tab),
  }));
}

/** A Word with every tab filled: Examples, links, more meanings and an etymology. */
const fullWord = word('w_sumyrnyi', 'сумирний', {
  examples: [{ text: 'Сумирний кінь стояв тихо.', author: 'Іван Франко' }],
  synonyms: ['тихий'],
  antonyms: ['буйний'],
  extraDefinitions: ['Покірний.', 'Миролюбний.'],
  etymology: 'Від «мир».',
});

describe('the tabs of a Word card in the Feed', () => {
  it('shows the four tabs, «Суть» selected with the Definition', async () => {
    await open(fullWord);
    await renderApp();

    const card = wordCard();
    expect(tabsOf(card)).toEqual([
      { name: 'Суть', selected: true },
      { name: 'Приклад', selected: false },
      { name: 'Зв’язки', selected: false },
      { name: 'Історія', selected: false },
    ]);
    expect(card.getByText('Значення слова сумирний.', hidden)).toBeTruthy();
    expect(card.queryByText('Сумирний кінь стояв тихо.', hidden)).toBeNull();
  });

  it('shows the Example and its author on «Приклад», the Lemma and the corner kept', async () => {
    await open(fullWord);
    await renderApp();
    await swipeUp();
    const corner = () =>
      wordCard().queryByTestId('word-corner', hidden) ??
      wordCard().queryByTestId('word-actions', hidden);
    expect(corner()).not.toBeNull();

    await settle(() => fireEvent.press(wordCard().getByTestId('word-tab-example')));

    const card = wordCard();
    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Приклад');
    expect(card.getByText(/Сумирний кінь стояв тихо\./, hidden)).toBeTruthy();
    expect(card.getByText(/Іван Франко/, hidden)).toBeTruthy();
    expect(card.queryByText('Значення слова сумирний.', hidden)).toBeNull();
    expect(card.getByTestId('word-lemma', hidden)).toBeTruthy();
    expect(corner()).not.toBeNull();
  });

  it('leaves out «Зв’язки» for a Word without Synonyms and antonyms', async () => {
    await open({ ...fullWord, synonyms: [], antonyms: [] });
    await renderApp();

    expect(tabsOf(wordCard()).map(({ name }) => name)).toEqual(['Суть', 'Приклад', 'Історія']);
  });

  it('draws no tab bar when «Суть» is the only tab with anything in it', async () => {
    await open(word('w_sumyrnyi', 'сумирний'));
    await renderApp();

    const card = wordCard();
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Значення слова сумирний.', hidden)).toBeTruthy();
  });

  it('counts the other meanings in «Суть» and numbers them in «Історія»', async () => {
    await open(fullWord);
    await renderApp();
    await swipeUp();
    expect(wordCard().getByText('Ще 2 значення — у вкладці «Історія».', hidden)).toBeTruthy();

    await settle(() => fireEvent.press(wordCard().getByTestId('word-tab-history')));

    const card = wordCard();
    expect(card.getByText('1. Покірний.', hidden)).toBeTruthy();
    expect(card.getByText('2. Миролюбний.', hidden)).toBeTruthy();
  });

  it('keeps a very long Definition whole in a tab too short for it, the corner still working', async () => {
    const long = `${'Дуже довге значення слова, яке не вміщається в картку. '.repeat(40)}Кінець.`;
    await open({ ...fullWord, primaryDefinition: long });
    await renderApp();
    await swipeUp();
    const layout = async (testID: string, height: number) => {
      await fireEvent(wordCard().getByTestId(testID, hidden), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
      });
      await settle();
    };

    // The room the frame leaves the tab, then the content too tall at every size down to the floor.
    await layout('word-tab-panel', 200);
    for (
      let size = 0;
      size < 4 && wordCard().queryByTestId('word-tab-scroll', hidden) === null;
      size++
    )
      await layout('word-tab-content', 2000);

    const card = wordCard();
    expect(card.getByTestId('word-tab-scroll', hidden)).toBeTruthy();
    expect(card.getByText(long, hidden)).toBeTruthy();
    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Суть');
    const heart = card.getByTestId('favorite-button', hidden);
    expect(heart.props['accessibilityLabel']).toBe(editionStrings.favorites.heart.add);
    await settle(() => fireEvent.press(heart));
    expect(wordCard().getByTestId('favorite-button', hidden).props['accessibilityLabel']).toBe(
      editionStrings.favorites.heart.remove,
    );
  });

  it('shrinks a Definition a font size at a time before it scrolls, whichever height comes last', async () => {
    const long = `${'Довге значення слова. '.repeat(20)}Кінець.`;
    await open({ ...fullWord, primaryDefinition: long });
    await renderApp('XL');
    await swipeUp();
    const layout = async (testID: string, height: number) => {
      await fireEvent(wordCard().getByTestId(testID, hidden), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
      });
      await settle();
    };
    const size = (): unknown => {
      const style: unknown = StyleSheet.flatten(wordCard().getByText(long, hidden).props['style']);
      return typeof style === 'object' && style !== null && 'fontSize' in style
        ? style.fontSize
        : undefined;
    };
    const scrolls = () => wordCard().queryByTestId('word-tab-scroll', hidden) !== null;
    expect(size()).toBe(fontSizeSteps.XL.definition);

    // The content is drawn before the frame leaves it its room: the check waits for the room.
    await layout('word-tab-content', 300);
    expect(size()).toBe(fontSizeSteps.XL.definition);
    await layout('word-tab-panel', 200);
    expect(size()).toBe(fontSizeSteps.L.definition);
    expect(scrolls()).toBe(false);

    // A step smaller it fits, so it stays whole there without a scroll.
    await layout('word-tab-content', 180);
    expect(size()).toBe(fontSizeSteps.L.definition);
    expect(scrolls()).toBe(false);

    // Too tall again, it takes M, then S, and only then scrolls.
    await layout('word-tab-content', 300);
    expect(size()).toBe(fontSizeSteps.M.definition);
    expect(scrolls()).toBe(false);
    await layout('word-tab-content', 300);
    expect(size()).toBe(fontSizeSteps.S.definition);
    expect(scrolls()).toBe(false);
    await layout('word-tab-content', 300);
    expect(scrolls()).toBe(true);
  });

  it('lets the tabbed card take the page height through the swipe of its marks', async () => {
    await open(fullWord);
    await renderApp();
    await swipeUp();

    // Jest lays nothing out, so the frame is checked where the page's height passes down.
    const around = (testID: string) =>
      screen
        .getAllByTestId(testID, hidden)
        .find((each) => within(each).queryByTestId('word-tab-panel', hidden) !== null);
    expect(around('swipe-frame')).toHaveStyle({ flexGrow: 1 });
    expect(around('swipe-card')).toHaveStyle({ flexGrow: 1 });
  });

  it('keeps the column with «Детальніше» with `wordTabs` off', async () => {
    await open(fullWord, false);
    await renderApp();

    const card = wordCard();
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Детальніше', hidden)).toBeTruthy();
    expect(card.getByText('Значення слова сумирний.', hidden)).toBeTruthy();
  });
});

/** An Idiom with every tab filled: two Definitions, an origin and an Example. */
const fullIdiom: Idiom = {
  kind: 'idiom',
  id: 'i_bytybaidyky',
  expression: 'бити байдики',
  idiomType: 'idiom',
  primaryDefinition: 'Ледарювати.',
  extraDefinitions: ['Гаяти час.'],
  examples: [{ text: 'Годі бити байдики!', author: 'Марко Вовчок' }],
  etymology: 'Байдики — дрібні тріски.',
  sources: [{ title: 'Словник фразеологізмів' }],
  retired: false,
};

/** The Idiom card, which the Feed draws once the reader swipes past the Word of the Day. */
function idiomCard() {
  return within(screen.getByTestId('idiom-card', hidden));
}

describe('the look of a tabbed Word card in the Feed (board p1)', () => {
  const { accent, ink } = editionTokens.colors.light;

  it('draws the tab bar at the foot of the card, under the panel, a bar over the selected tab', async () => {
    await open(fullWord);
    await renderApp();

    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn.indexOf('"testID":"word-tab-panel"')).toBeGreaterThan(-1);
    expect(drawn.indexOf('"accessibilityRole":"tablist"')).toBeGreaterThan(
      drawn.indexOf('"testID":"word-tab-panel"'),
    );
    await swipeUp();
    const card = wordCard();
    expect(card.getByTestId('word-tab-essence-bar', hidden)).toBeTruthy();
    expect(card.queryByTestId('word-tab-example-bar', hidden)).toBeNull();

    await settle(() => fireEvent.press(card.getByTestId('word-tab-example')));

    expect(wordCard().getByTestId('word-tab-example-bar', hidden)).toBeTruthy();
    expect(wordCard().queryByTestId('word-tab-essence-bar', hidden)).toBeNull();
  });

  it('outlines the card in ink over a red offset shadow', async () => {
    await open(fullWord);
    await renderApp();

    const frame = screen
      .getAllByTestId('word-card', hidden)
      .find((each) => within(each).queryByTestId('word-tab-panel', hidden) !== null);
    expect(frame).toHaveStyle({ borderColor: ink });
    expect(frame).toHaveStyle({
      boxShadow: [
        {
          offsetX: entryCardFrame.shadow,
          offsetY: entryCardFrame.shadow,
          blurRadius: 0,
          color: accent,
        },
      ],
    });
  });

  it('sets the stressed letter in red over a red rule under the Lemma', async () => {
    await open(fullWord);
    await renderApp();

    const card = wordCard();
    const lemma = within(card.getByTestId('word-lemma', hidden));
    expect(lemma.getByText('у', hidden)).toHaveStyle({ color: accent });
    expect(card.getByTestId('word-rule', hidden)).toBeTruthy();
  });

  it('keeps the Category chip in the grammar line above the tabs, whichever tab is selected', async () => {
    await open(fullWord);
    await renderApp();

    await swipeUp();
    const grammar = () => within(wordCard().getByTestId('word-grammar', hidden));
    expect(grammar().getByTestId('word-category', hidden)).toBeTruthy();
    expect(wordCard().getAllByTestId('word-category', hidden)).toHaveLength(1);

    await settle(() => fireEvent.press(wordCard().getByTestId('word-tab-example')));

    expect(grammar().getByTestId('word-category', hidden)).toBeTruthy();
  });
});

describe('the tabs of an Idiom card in the Feed', () => {
  it('shows «Суть», «Звідки» and «Приклад», «Суть» selected with the Definitions', async () => {
    await open(word('w_sumyrnyi', 'сумирний'), true, [fullIdiom]);
    await renderApp();
    await swipeUp();

    const card = idiomCard();
    expect(tabsOf(card)).toEqual([
      { name: 'Суть', selected: true },
      { name: 'Звідки', selected: false },
      { name: 'Приклад', selected: false },
    ]);
    expect(card.getByText('Ледарювати.', hidden)).toBeTruthy();
    expect(card.getByText('2. Гаяти час.', hidden)).toBeTruthy();
    expect(card.queryByText('Байдики — дрібні тріски.', hidden)).toBeNull();
    expect(card.queryByText('Походження', hidden)).toBeNull();
    // The Definition offers VoiceOver the card's page actions, its Knowledge Marks first.
    const actions: unknown = card.getByTestId('idiom-definition', hidden).props[
      'accessibilityActions'
    ];
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'known' }),
        expect.objectContaining({ name: 'unknown' }),
      ]),
    );
  });

  it('shows where the expression comes from on «Звідки»', async () => {
    await open(word('w_sumyrnyi', 'сумирний'), true, [fullIdiom]);
    await renderApp();
    await swipeUp();
    // A second swipe makes the Idiom the card on screen, the one a tap reaches.
    await swipeUp();

    await settle(() => fireEvent.press(idiomCard().getByTestId('idiom-tab-origin')));

    const card = idiomCard();
    expect(tabsOf(card).find(({ selected }) => selected)?.name).toBe('Звідки');
    expect(card.getByText('Байдики — дрібні тріски.', hidden)).toBeTruthy();
    expect(card.queryByText('Ледарювати.', hidden)).toBeNull();
    expect(card.getByTestId('idiom-expression', hidden)).toBeTruthy();
  });

  it('leaves out «Звідки» for an Idiom without an origin', async () => {
    await open(word('w_sumyrnyi', 'сумирний'), true, [{ ...fullIdiom, etymology: undefined }]);
    await renderApp();
    await swipeUp();

    expect(tabsOf(idiomCard()).map(({ name }) => name)).toEqual(['Суть', 'Приклад']);
  });

  it('keeps the column with «Походження» with `wordTabs` off', async () => {
    await open(word('w_sumyrnyi', 'сумирний'), false, [fullIdiom]);
    await renderApp();
    await swipeUp();

    const card = idiomCard();
    expect(tabsOf(card)).toEqual([]);
    expect(card.getByText('Походження', hidden)).toBeTruthy();
    expect(card.getByText('Ледарювати.', hidden)).toBeTruthy();
    expect(card.getByText('Байдики — дрібні тріски.', hidden)).toBeTruthy();
  });
});
