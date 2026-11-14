import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
  type Haptics,
  type NotificationSchedulerPort,
} from '@slovo/core';
import {
  createMemoryContentPort,
  seedUserState,
  type UserStateFacts,
  type XpRecord,
} from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, ReduceMotionProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/feed';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Unbounded' } } } },
}));

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition: Edition = loadEdition(config);
// Feed Notices take one card each, a later question before the explainer.
const withoutLaterQuestions: Edition = {
  ...shippedEdition,
  isFeatureEnabled: (feature) =>
    feature !== 'laterQuestions' && shippedEdition.isFeatureEnabled(feature),
};

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-11-02T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

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
function word(id: string, lemma: string): Word {
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
  };
}

/** One XP record of `amount` from a game round on the local day `date`, at 08:00 in Kyiv. */
const xp = (date: string, amount: number): XpRecord => ({
  kind: 'xp',
  date,
  at: new Date(`${date}T08:00:00+03:00`).toISOString(),
  source: 'game-round',
  amount,
});

/**
 * Opens the composition over two Words, and the `words` given after them, for a reader who finished the
 * onboarding with the facts given, on 2026-10-28 in Kyiv: with the XP
 * earned before, each record on its own day, and signed in or out as
 * `signedIn` says, as the app tells the Core once the Account is open.
 */
async function open(
  facts: UserStateFacts,
  {
    scheduler,
    edition: openedEdition = shippedEdition,
    xp: earned = [],
    signedIn,
    words: more = [],
  }: {
    scheduler?: NotificationSchedulerPort;
    edition?: Edition;
    xp?: readonly XpRecord[];
    signedIn?: () => boolean;
    words?: readonly Word[];
  } = {},
) {
  userState = await seedUserState(
    {
      ...facts,
      // The gestures hint was shown on an earlier launch: its finger demo loops for as long as
      // the sheet is open, which settling every timer would never finish. It has its own test.
      gesturesHintShown: true,
      xpLog: Object.fromEntries(earned.map((record, index) => [`seeded-${String(index)}`, record])),
    },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний'), ...more],
    }),
    edition: openedEdition,
    userState: userState,
    clock,
    // The first Word in each draw, so each opening shows the same Word of the Day.
    random: { next: () => 0 },
    ...(signedIn === undefined ? {} : { signedIn }),
    ...(scheduler === undefined
      ? {}
      : {
          scheduling: {
            scheduler,
            ellipsis: '…',
            titles: ['{word}'],
            farewell: 'Пауза',
            streakWarning: 'Серія',
            goalNotMet: 'Ціль',
          },
        }),
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
    remoteSwitches: switchedTo(shippedEdition),
    composition: opened(composition),
  });

/** The Account screen stands in: the save-progress Notice opens it, and its own tests draw it. */
const AccountStandIn = () => null;

/** The app on the Feed, with the Entry screen a link opens and the Account screen a Notice opens. */
async function renderApp(reduceMotion = false) {
  const app = await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ReduceMotionProvider reduceMotion={reduceMotion}>
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
          </ReduceMotionProvider>
        </SafeAreaProvider>
      ),
      index: HomeScreen,
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
      'settings/account': AccountStandIn,
    },
    { initialUrl: '/' },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
  // Not the render result itself: an async function would await it, as it is thenable.
  return { pathname: () => app.getPathname() };
}

const hidden = { includeHiddenElements: true };

/** How far, in points, a drag goes before the swipe takes it, as on the device. */
const ACTIVATION = 12;

/** One swipe up on the Feed, which turns it to the next page. */
async function swipeUp() {
  const distance = -400;
  await settle(() => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: distance, velocityY: -1000 },
      { state: State.END, translationY: distance, velocityY: -1000 },
    ]);
  });
}

/** The position of the Feed page that holds `element`, from the `feed-card-N` test ID above it. */
function pageOf(element: ReturnType<typeof screen.getByTestId>): number {
  for (let node: typeof element | null = element; node !== null; node = node.parent) {
    const match = /^feed-card-(\d+)$/.exec(String((node.props as { testID?: unknown }).testID));
    if (match !== null) return Number(match[1]);
  }
  throw new Error('The element is on no Feed page');
}

/** Swipes the Feed up to the page that holds `element`. */
async function swipeTo(element: ReturnType<typeof screen.getByTestId>) {
  for (let page = pageOf(element); page > 0; page -= 1) await swipeUp();
}

const words = editionStrings.feedNotices.weeklyRecap;

/**
 * A reader past the first week, active last week, whose Word of the Day
 * yesterday was «лагідний», unless they had none.
 */
async function openMonday({ yesterday = true }: { yesterday?: boolean } = {}) {
  await open(
    {
      onboardingFinished: '2026-09-01T09:00:00Z',
      wordOfTheDayArchive: yesterday ? { '2026-11-01': 'w_lahidnyi' } : {},
    },
    {
      edition: withoutLaterQuestions,
      xp: [xp('2026-10-28', 20)],
      words: [word('w_tykhyi', 'тихий')],
    },
  );
}

/** Opens the Feed on the Weekly Recap's page. */
async function onWeeklyRecap(reduceMotion = false, yesterday = true) {
  await openMonday({ yesterday });
  await renderApp(reduceMotion);
  await swipeTo(screen.getByTestId('feed-notice-weeklyRecap', hidden));
}

describe('«Твій тиждень» on the Feed', () => {
  it('shows the week with its dates on top, and Yesterday under it on the same page', async () => {
    await onWeeklyRecap();

    const week = screen.getByTestId('feed-notice-weeklyRecap');
    expect(within(week).getByText('26.10–1.11')).toBeOnTheScreen();
    expect(pageOf(screen.getByTestId('feed-notice-yesterday'))).toBe(pageOf(week));
  });

  it('«Готово» folds the week away after its fold, with a toast whose «Повернути» brings it back', async () => {
    await onWeeklyRecap();

    await fireEvent.press(screen.getByRole('button', { name: words.done }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('feed-notice-weeklyRecap')).toBeOnTheScreen();
    await settle();

    expect(screen.queryByTestId('feed-notice-weeklyRecap')).toBeNull();
    expect(screen.getByTestId('feed-notice-yesterday')).toBeOnTheScreen();
    expect(screen.getByText(words.folded)).toBeOnTheScreen();

    await settle(() => fireEvent.press(screen.getByText(words.restore)));

    expect(screen.getByTestId('feed-notice-weeklyRecap')).toBeOnTheScreen();
    expect(screen.getByTestId('feed-notice-yesterday')).toBeOnTheScreen();
  });

  it('folded with no Yesterday under it, its page leaves the Feed while «Повернути» brings it back', async () => {
    await onWeeklyRecap(true, false);
    const page = pageOf(screen.getByTestId('feed-notice-weeklyRecap'));
    const next = screen.getByTestId(`feed-card-${String(page + 1)}`, hidden);
    const meaningAfter = ['сумирний', 'лагідний', 'тихий']
      .map((lemma) => `Значення слова ${lemma}.`)
      .find((meaning) => within(next).queryByText(meaning, hidden) !== null);
    if (meaningAfter === undefined) throw new Error('No Word after the Weekly Recap');

    await fireEvent.press(screen.getByRole('button', { name: words.done }));
    // Well within the toast's 4 s.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(screen.queryByTestId('feed-notice-weeklyRecap', hidden)).toBeNull();
    // The next Word's card takes the page's place.
    const there = screen.getByTestId(`feed-card-${String(page)}`);
    expect(within(there).getByText(meaningAfter)).toBeOnTheScreen();
    expect(screen.getByText(words.folded)).toBeOnTheScreen();

    await settle(() => fireEvent.press(screen.getByText(words.restore)));

    const week = screen.getByTestId('feed-notice-weeklyRecap');
    expect(week).toBeOnTheScreen();
    expect(pageOf(week)).toBe(page);
  });

  it('folds the week away at once under Reduce Motion', async () => {
    await onWeeklyRecap(true);

    await fireEvent.press(screen.getByRole('button', { name: words.done }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(screen.queryByTestId('feed-notice-weeklyRecap')).toBeNull();
    expect(screen.getByText(words.folded)).toBeOnTheScreen();
  });
});

describe('«Пам’ятаєш учорашнє слово?» on the Feed (ADR 0130)', () => {
  const yesterday = editionStrings.feedNotices.yesterday;
  const { chosen, correct } = editionStrings.game.round;
  const right = 'Значення слова лагідний.';
  const wrong = 'Значення слова тихий.';
  const verdict = () => screen.getByTestId('yesterday-verdict');
  /** Whether yesterday's Word is being learned: marked «Не знаю», its Review started. */
  const inReview = () =>
    composition.knowledge.state.learning.some(({ entryId }) => entryId === 'w_lahidnyi');

  it('asks about yesterday’s Word with three meanings, its own among them', async () => {
    await onWeeklyRecap();

    const card = within(screen.getByTestId('feed-notice-yesterday'));
    expect(card.getByRole('header', { name: yesterday.title })).toBeOnTheScreen();
    for (const meaning of [right, wrong, 'Значення слова сумирний.'])
      expect(card.getByRole('button', { name: meaning })).toBeOnTheScreen();
  });

  it('marks the Word «Знаю» on the right meaning, with «Влучно!»', async () => {
    await onWeeklyRecap();

    await settle(() => fireEvent.press(screen.getByRole('button', { name: right })));

    expect(verdict()).toHaveTextContent(yesterday.right);
    expect(screen.getByRole('button', { name: `${right}, ${correct}` })).toBeOnTheScreen();
    expect(composition.knowledge.isKnown('w_lahidnyi')).toBe(true);
    expect(inReview()).toBe(false);
  });

  it('starts the Word’s Review on a wrong meaning, and lights the right one', async () => {
    await onWeeklyRecap();

    await settle(() => fireEvent.press(screen.getByRole('button', { name: wrong })));

    expect(verdict()).toHaveTextContent(yesterday.wrong);
    expect(screen.getByRole('button', { name: `${wrong}, ${chosen}` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `${right}, ${correct}` })).toBeOnTheScreen();
    expect(inReview()).toBe(true);
    expect(composition.knowledge.isKnown('w_lahidnyi')).toBe(false);
  });

  it('clears the pick on a second tap; another pick changes only the look', async () => {
    await onWeeklyRecap();

    await settle(() => fireEvent.press(screen.getByRole('button', { name: wrong })));
    await settle(() =>
      fireEvent.press(screen.getByRole('button', { name: `${wrong}, ${chosen}` })),
    );

    expect(verdict()).toHaveTextContent('');
    expect(screen.getByRole('button', { name: wrong })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: right })).toBeOnTheScreen();

    await settle(() => fireEvent.press(screen.getByRole('button', { name: right })));

    expect(verdict()).toHaveTextContent(yesterday.right);
    expect(inReview()).toBe(true);
  });

  it('takes the answer under Reduce Motion too', async () => {
    await onWeeklyRecap(true);

    await settle(() => fireEvent.press(screen.getByRole('button', { name: wrong })));

    expect(verdict()).toHaveTextContent(yesterday.wrong);
    expect(screen.getByRole('button', { name: `${right}, ${correct}` })).toBeOnTheScreen();
    expect(inReview()).toBe(true);
  });
});
