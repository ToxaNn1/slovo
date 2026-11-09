import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition, type Haptics } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { renderRoutes } from '../shell/test-render';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import GameLayout from '../app/game/_layout';
import GameEntryScreen from '../app/game/[entryId]';
import SavedLayout from '../app/saved/_layout';
import CollectionEntryScreen from '../app/saved/collections/[collectionId]/[entryId]';
import FavoriteEntryScreen from '../app/saved/favorites/[entryId]';
import HistoryEntryScreen from '../app/saved/history/[entryId]';
import LearningEntryScreen from '../app/saved/learning/[entryId]';
import WordOfTheDayEntryScreen from '../app/saved/words-of-the-day/[entryId]';
import SearchLayout from '../app/search/_layout';
import EntryFromSearchScreen from '../app/search/[entryId]';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import {
  opened,
  recordedAnalytics,
  switchedTo,
  testShell,
  type RecordedAnalytics,
  analyticsInto,
} from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

// The Entry card's action row and corner have their own tests; here they are stand-ins to find on the screen.
jest.mock('./entry-actions', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const { entrySwipe, useEntryMarks } =
    jest.requireActual<typeof import('./entry-actions')>('./entry-actions');
  return {
    useEntrySlots: (card: { entryId: string }) => {
      const marks = useEntryMarks(card.entryId);
      return marks.swiped
        ? { slot: 'corner', corner: <View testID="entry-corner" />, swipe: entrySwipe(marks) }
        : { slot: 'actions', actions: <View testID="entry-actions" /> };
    },
  };
});

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition = loadEdition(activeEditionFiles.config);

/** Whether the Swipe Marks switch is on in effect: off as the Edition ships it unless a test turns it on. */
let swipeMarksOn = false;

/** Whether the Word tabs switch is on in effect: on as the Edition ships it unless a test turns it off. */
let wordTabsOn = true;

/** The Edition in effect: as it ships, with the Swipe Marks and Word tabs switches as the test sets them. */
const editionInEffect = (): typeof shippedEdition => ({
  ...shippedEdition,
  isFeatureEnabled: (feature) =>
    feature === 'swipeMarks'
      ? swipeMarksOn
      : feature === 'wordTabs'
        ? wordTabsOn
        : shippedEdition.isFeatureEnabled(feature),
});

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  // The home indicator of an iPhone with Face ID.
  insets: { top: 0, left: 0, right: 0, bottom: 34 },
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

/** A Correction of the Edition's first Correction Category. */
function correction(id: string, nonStandardForm: string): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType: 'surzhyk',
    standardEquivalents: ['чемний'],
    explanation: `Чому не «${nonStandardForm}».`,
    examplePair: { nonStandard: `Кажуть ${nonStandardForm}.`, standard: 'Кажи чемний.' },
    categoryId: 'everyday',
    sources: [{ title: 'Словник' }],
    literaryUses: [],
    retired: false,
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
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      correctionCategories: [
        { id: 'everyday', displayName: 'Щоденне', description: 'Як кажуть щодня.', tone: 'loud' },
      ],
      words: [
        word('w_sumyrnyi', 'сумирний', 'Колись означало лише «покірний».'),
        word('w_lahidnyi', 'лагідний'),
        { ...word('w_chemnyi', 'чемний'), correctionIds: ['c_vezhlyvyi'] },
      ],
      corrections: [correction('c_vezhlyvyi', 'вежливий')],
    }),
    edition: shippedEdition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0 },
    analytics: analyticsInto(analytics.port),
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
    remoteSwitches: switchedTo(editionInEffect()),
  });
  const app = await renderRoutes(
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
      'search/_layout': SearchLayout,
      'search/[entryId]': EntryFromSearchScreen,
      'game/_layout': GameLayout,
      'game/[entryId]': GameEntryScreen,
      'saved/_layout': SavedLayout,
      'saved/history/[entryId]': HistoryEntryScreen,
      'saved/favorites/[entryId]': FavoriteEntryScreen,
      'saved/learning/[entryId]': LearningEntryScreen,
      'saved/words-of-the-day/[entryId]': WordOfTheDayEntryScreen,
      'saved/collections/[collectionId]/[entryId]': CollectionEntryScreen,
    },
    { initialUrl: url },
  );
  await settle();
  return { pathname: () => app.getPathname() };
}

/** The back tile of the Entry screen on top of the stack. */
function backOnTop() {
  const top = screen.getAllByTestId('entry-screen-back').at(-1);
  if (top === undefined) throw new Error('No Entry screen is open');
  return top;
}

/** The Word History events the port got. */
const historyOpened = () => analytics.events.filter(({ event }) => event === 'wordHistoryOpened');

describe('the Entry screen and the Word History', () => {
  it('tells Analytics the Word History opened once, with the Entry, when the section is drawn', async () => {
    await renderEntry('w_sumyrnyi');
    // With `wordTabs` on, the Word History is drawn on «Історія» alone (ADR 0091).
    expect(historyOpened()).toEqual([]);
    await fireEvent.press(screen.getByTestId('word-tab-history'));
    await settle();

    expect(screen.getByTestId('word-history')).toBeOnTheScreen();
    expect(historyOpened()).toEqual([
      {
        event: 'wordHistoryOpened',
        properties: { entryKind: 'word', rarity: 3, categoryId: 'emotions-character' },
      },
    ]);
  });

  it('tells Analytics once per Entry, however often «Історія» is drawn again', async () => {
    await renderEntry('w_sumyrnyi');
    await fireEvent.press(screen.getByTestId('word-tab-history'));
    await settle();
    // Another tab, then «Історія» again, and a smaller size that draws the tab anew.
    await fireEvent.press(screen.getByTestId('word-tab-essence'));
    await settle();
    await fireEvent.press(screen.getByTestId('word-tab-history'));
    await settle();
    await fireEvent(screen.getByTestId('word-tab-panel'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 10 } },
    });
    await fireEvent(screen.getByTestId('word-tab-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 900 } },
    });
    await settle();

    expect(historyOpened()).toHaveLength(1);
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

describe('a tab too long for the Entry screen', () => {
  it("is clamped under «Детальніше», which opens it whole in the screen's scroll (ADR 0091)", async () => {
    await renderEntry('w_sumyrnyi');
    await fireEvent.press(screen.getByTestId('word-tab-history'));
    await settle();
    await fireEvent(screen.getByTestId('word-tab-panel'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 10 } },
    });
    for (let size = 0; size < 4 && screen.queryByTestId('word-tab-more') === null; size++) {
      await fireEvent(screen.getByTestId('word-tab-content'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 900 } },
      });
      await settle();
    }

    expect(
      within(screen.getByTestId('entry-scroll')).getByTestId('word-tab-more'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('word-tab-more'));
    await settle();

    expect(screen.queryByTestId('word-tab-more')).not.toBeOnTheScreen();
    expect(screen.getByTestId('word-history')).toBeOnTheScreen();
  });
});

describe('the Entry screen and the side swipes (ADR 0077)', () => {
  afterEach(() => {
    swipeMarksOn = false;
  });

  it('marks the Word Known on a swipe right with the Swipe Marks switch on, with its stamp', async () => {
    swipeMarksOn = true;
    await renderEntry('w_sumyrnyi');

    await act(async () => {
      fireGestureHandler(getByGestureTestId('entry-card-side-swipe'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 8 },
        { state: State.ACTIVE, translationX: 200 },
        { state: State.END, translationX: 200 },
      ]);
      await Promise.resolve();
    });
    await settle();

    expect(composition.knowledge.state.shown.get('w_sumyrnyi')).toBe('known');
    expect(screen.getByTestId('swipe-stamp')).toBeOnTheScreen();
    expect(screen.getByTestId('undo-toast')).toBeOnTheScreen();
  });

  it('keeps the Word’s corner at the panel’s top right with the Swipe Marks switch on', async () => {
    swipeMarksOn = true;
    await renderEntry('w_sumyrnyi');

    expect(within(screen.getByTestId('entry-panel')).getByTestId('entry-corner')).toBeOnTheScreen();
    expect(screen.queryByTestId('entry-actions')).not.toBeOnTheScreen();
  });

  it('has no side swipes with the Swipe Marks switch off', async () => {
    await renderEntry('w_sumyrnyi');

    expect(screen.getByTestId('word-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('swipe-card')).not.toBeOnTheScreen();
  });
});

/** The tabs on the Entry screen, by their names, with whether each is selected. */
function tabsOnScreen() {
  const selected = screen.queryAllByRole('tab', { selected: true });
  return screen.queryAllByRole('tab').map((tab) => ({
    name: String(tab.props['accessibilityLabel']),
    selected: selected.includes(tab),
  }));
}

describe('the tabs of an Entry card on the Entry screen (ADR 0091)', () => {
  afterEach(() => {
    wordTabsOn = true;
    swipeMarksOn = false;
  });

  it('shows a Word with its tabs, «Суть» selected with the Definition', async () => {
    await renderEntry('w_sumyrnyi');

    expect(tabsOnScreen()[0]).toEqual({ name: 'Суть', selected: true });
    expect(tabsOnScreen().map(({ name }) => name)).toContain('Історія');
    expect(screen.getByTestId('word-definition')).toBeOnTheScreen();
  });

  it('shows a Correction with «Як краще», «Чому» and «Приклади», «Як краще» selected', async () => {
    await renderEntry('c_vezhlyvyi');

    expect(tabsOnScreen()).toEqual([
      { name: 'Як краще', selected: true },
      { name: 'Чому', selected: false },
      { name: 'Приклади', selected: false },
    ]);
    expect(screen.getByTestId('correction-tab-panel')).toBeOnTheScreen();
  });

  it.each([
    ['off', false],
    ['on', true],
  ])(
    'stands the tab bar at the foot of the screen with the Swipe Marks switch %s (owner 08.11)',
    async (_, swiped) => {
      swipeMarksOn = swiped;
      await renderEntry('w_sumyrnyi');

      // Under the tab bar: the docked action row, or the room for the swipe's stamp,
      // which takes in the home indicator; the scroll adds nothing of its own.
      expect(screen.getByTestId('word-card')).toHaveStyle({ paddingBottom: 0 });
      const scroll = screen.getByTestId('entry-scroll');
      const content: unknown = StyleSheet.flatten(scroll.props['contentContainerStyle']);
      expect(content).toMatchObject({ flexGrow: 1, paddingBottom: 0 });
    },
  );

  it('keeps a Word and a Correction in one column with `wordTabs` off', async () => {
    wordTabsOn = false;
    await renderEntry('w_sumyrnyi');
    expect(tabsOnScreen()).toEqual([]);
    expect(screen.getByTestId('word-definition')).toBeOnTheScreen();

    await renderEntry('c_vezhlyvyi');
    expect(tabsOnScreen()).toEqual([]);
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

describe('the Entry screen of each stack', () => {
  const stacks: readonly (readonly [string, string])[] = [
    ['/entry', editionStrings.tabs.home],
    ['/search', editionStrings.search.title],
    ['/game', editionStrings.game.title],
    ['/saved/history', editionStrings.history.title],
    ['/saved/favorites', editionStrings.favorites.title],
    ['/saved/learning', editionStrings.learning.title],
    ['/saved/words-of-the-day', editionStrings.wordOfTheDayArchive.title],
    ['/saved/collections/none', editionStrings.collections.title],
  ];

  it.each(stacks)(
    'at %s names its Back, opens a linked Correction on the same stack and goes back to the Word',
    async (route, back) => {
      const app = await renderEntry('w_chemnyi', `${route}/w_chemnyi`);
      expect(backOnTop()).toHaveProp('accessibilityLabel', back);

      await act(async () => {
        await fireEvent.press(screen.getByTestId('word-often-said-c_vezhlyvyi'));
        await jest.runAllTimersAsync();
      });

      expect(app.pathname()).toBe(`${route}/c_vezhlyvyi`);
      // The Word's lemma with its stress mark.
      expect(backOnTop()).toHaveProp('accessibilityLabel', 'че\u0301мний');

      await act(async () => {
        await fireEvent.press(backOnTop());
        await jest.runAllTimersAsync();
      });

      expect(app.pathname()).toBe(`${route}/w_chemnyi`);
      expect(backOnTop()).toHaveProp('accessibilityLabel', back);
    },
  );

  it('names the Back of a Collection’s Entry after the Collection', async () => {
    const created = await composition.collections.create('Ввічливі', 'w_chemnyi');
    if (!created.ok) throw new Error(`The Collection was refused: ${created.reason}`);

    await renderEntry('w_chemnyi', `/saved/collections/${created.collection.id}/w_chemnyi`);

    expect(backOnTop()).toHaveProp('accessibilityLabel', 'Ввічливі');
  });
});
