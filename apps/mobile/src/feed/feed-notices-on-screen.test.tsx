import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  trackChanges,
  userStateRecords,
  type Composition,
  type Edition,
  type Haptics,
  type NotificationSchedulerPort,
  type XpRecord,
} from '@slovo/core';
import { createFakeNotificationScheduler, createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';
import { SettingsProvider } from '../settings/settings';

const { config } = activeEditionFiles;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Kurale' } } } },
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
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));
// The Entry card's action row has its own tests.
jest.mock('../entries/entry-actions', () => ({
  EntryActions: () => null,
  useKnowledgeButtons: () => null,
}));

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
 * Opens the composition over two Words for a reader who finished the
 * onboarding with the records given, on 2026-10-28 in Kyiv: with the XP
 * earned before, each record on its own day, and signed in or out as
 * `signedIn` says, as the app tells the Core once the Account is open.
 */
async function open(
  records: Readonly<Record<string, unknown>>,
  {
    scheduler,
    edition: openedEdition = shippedEdition,
    xp: earned = [],
    signedIn,
  }: {
    scheduler?: NotificationSchedulerPort;
    edition?: Edition;
    xp?: readonly XpRecord[];
    signedIn?: () => boolean;
  } = {},
) {
  userState = await openUserState({
    port: createMemoryUserStatePort(
      new Map(Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)])),
    ),
  });
  for (const [index, record] of earned.entries()) {
    await userState.write(userStateRecords.xpLog.record(`seeded-${String(index)}`).change(record));
  }
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний')],
    }),
    edition: openedEdition,
    userState: userState,
    clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
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
    userState: opened(
      trackChanges({
        userState,
        clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
      }),
    ),
    remoteSwitches: switchedTo(shippedEdition),
    composition: opened(composition),
  });

/** The Account screen stands in: the save-progress Notice opens it, and its own tests draw it. */
const AccountStandIn = () => null;

/** The app on the Feed, with the Entry screen a link opens and the Account screen a Notice opens. */
async function renderApp() {
  const app = renderRouter(
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
      'entry/_layout': EntryLayout,
      'entry/[entryId]': EntryFromLinkScreen,
      'settings/account': AccountStandIn,
    },
    { initialUrl: '/' },
  );
  await app;
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

describe('the Feed Notices on the Feed', () => {
  it('shows the first-week card of the first Active Day after the onboarding', async () => {
    await open({
      'onboarding.finished': '2026-10-28T08:00:00Z',
      'firstWeek.from': '2026-10-28',
    });
    await renderApp();

    const card = screen.getByTestId('feed-notice-firstWeek', hidden);
    const [day1] = editionStrings.feedNotices.firstWeek.days;
    expect(within(card).getByText(day1.title, hidden)).toBeTruthy();
  });

  it('shows a reader past the first week with no other notice due only the Daily Goal later question', async () => {
    await open({ 'onboarding.finished': '2026-09-01T09:00:00Z' });
    await renderApp();

    expect(screen.getAllByTestId('word-card', hidden).length).toBeGreaterThan(0);
    expect(
      screen.getAllByTestId(/^feed-notice-/, hidden).map(({ props }) => String(props['testID'])),
    ).toEqual(['feed-notice-dailyGoalChoice']);
  });

  it('shows the notification explainer by day 3, and the device is not asked before «Так»', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'not-asked' });
    await open(
      { 'onboarding.finished': '2026-10-26T08:00:00Z' },
      { scheduler, edition: withoutLaterQuestions },
    );
    await renderApp();

    const card = screen.getByTestId('feed-notice-notificationExplainer', hidden);
    const { title, yes } = editionStrings.feedNotices.notificationExplainer;
    expect(within(card).getByText(title, hidden)).toBeTruthy();
    expect(within(card).getByText(yes, hidden)).toBeTruthy();
    expect(await scheduler.permission()).toBe('not-asked');
  });

  it('shows no explainer to a reader the device asked already', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'denied' });
    await open({ 'onboarding.finished': '2026-10-26T08:00:00Z' }, { scheduler });
    await renderApp();

    expect(screen.queryByTestId('feed-notice-notificationExplainer', hidden)).toBeNull();
  });

  it('offers a signed-out reader to save progress on the day the Streak reaches 3, and «Зберегти прогрес» opens the Account screen', async () => {
    await open(
      { 'onboarding.finished': '2026-09-01T09:00:00Z' },
      {
        edition: withoutLaterQuestions,
        xp: [xp('2026-10-26', 5), xp('2026-10-27', 5), xp('2026-10-28', 5)],
        signedIn: () => false,
      },
    );
    const app = await renderApp();

    const card = screen.getByTestId('feed-notice-saveProgress', hidden);
    const { title, save } = editionStrings.feedNotices.saveProgress;
    expect(within(card).getByText(title, hidden)).toBeTruthy();
    expect(within(card).getByText(save, hidden)).toBeTruthy();

    // The Notice is a page the reader swipes to; until then the pager takes no touch on it.
    await swipeTo(card);
    await settle(() => fireEvent.press(screen.getByRole('button', { name: save })));

    expect(app.pathname()).toBe('/settings/account');
  });

  it('shows the level-milestone Notice on the day the reader reaches Level 5', async () => {
    // Level 5 of the UA Edition costs 306 XP in all: 300 earned before, and today's 10 reach it.
    await open(
      { 'onboarding.finished': '2026-09-01T09:00:00Z' },
      { edition: withoutLaterQuestions, xp: [xp('2026-10-20', 300), xp('2026-10-28', 10)] },
    );
    await renderApp();

    const card = screen.getByTestId('feed-notice-levelMilestone', hidden);
    expect(within(card).getByText('Рівень 5 — Читач', hidden)).toBeTruthy();
    expect(
      within(card).getByText(editionStrings.feedNotices.levelMilestone.message, hidden),
    ).toBeTruthy();
  });
});
