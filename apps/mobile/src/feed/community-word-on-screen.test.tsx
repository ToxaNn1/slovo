import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import {
  openComposition,
  type Composition,
  type Edition,
  type TrackedUserState,
} from '@slovo/core';
import {
  createFakeBackend,
  createMemoryContentPort,
  loadEdition,
  seedUserState,
} from '@slovo/core/testing';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import HomeScreen from '../app/feed';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { activeEditionFiles } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Unbounded' } } } },
}));

/** A Word of the pack, so the Feed has a Word of the Day before the Community Word. */
const word: Word = {
  kind: 'word',
  id: 'w_sumyrnyi',
  lemma: 'сумирний',
  stress: [1],
  partOfSpeech: 'adjective',
  primaryDefinition: 'Тихий і лагідний.',
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'everyday',
  rarity: 3,
  sources: [{ title: 'Словник' }],
  correctionIds: [],
  retired: false,
};

/** The Community Word: a Correction of the pack. */
const correction: Correction = {
  kind: 'correction',
  id: 'c_abc123',
  nonStandardForm: 'приймати до уваги',
  correctionType: 'calque',
  standardEquivalents: ['зважати на'],
  explanation: 'Чому краще зважати.',
  examplePair: { nonStandard: 'Прийняти до уваги.', standard: 'Зважати на це.' },
  categoryId: 'everyday',
  sources: [{ title: 'Test source' }],
  literaryUses: [],
  retired: false,
};

const shipped: Edition = loadEdition(activeEditionFiles.config);

/** The Edition with the Community Word on and no other Feed Notice before it. */
const edition: Edition = {
  ...shipped,
  // Words alone in the Mix: the Community Word is shown by its notice, not as a card of its own.
  userSettingDefaults: {
    ...shipped.userSettingDefaults,
    mix: {
      ...shipped.userSettingDefaults.mix,
      kinds: { correction: false, idiom: false, synonymRow: false, tip: false },
    },
  },
  isFeatureEnabled: (feature) =>
    feature === 'communityCounters' || feature === 'communityWord'
      ? true
      : feature !== 'laterQuestions' &&
        feature !== 'weeklyRecap' &&
        shipped.isFeatureEnabled(feature),
};

/** A local Monday in Kyiv. */
const clock = { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

let userState: TrackedUserState;
let composition: Composition;

/** A reader past the first week, on a Monday whose Community Word is the Correction, added 12 times. */
beforeEach(async () => {
  jest.useFakeTimers();
  const api = createFakeBackend();
  api.counters.answerCommunityWord({ entryId: correction.id, adds: 12 });
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00Z', gesturesHintShown: true },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'everyday', displayName: 'Щодня', description: 'Щодня.', tone: 'loud' }],
      words: [word, { ...word, id: 'w_lahidnyi', lemma: 'лагідний' }],
      corrections: [correction],
    }),
    edition,
    userState,
    clock,
    random: { next: () => 0 },
    backend: api.backend,
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

/** The position of the Feed page that holds `element`, from the `feed-card-N` test ID above it. */
function pageOf(element: ReturnType<typeof screen.getByTestId>): number {
  for (let node: typeof element | null = element; node !== null; node = node.parent) {
    const match = /^feed-card-(\d+)$/.exec(String((node.props as { testID?: unknown }).testID));
    if (match !== null) return Number(match[1]);
  }
  throw new Error('The element is on no Feed page');
}

/** One swipe up on the Feed, which turns it to the next page. */
async function swipeUp() {
  await settle(() => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -12, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -12, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
  });
}

/** The app on the Feed, turned to the Community Word's page, with the Entry screen its tap opens. */
async function onCommunityWord() {
  const app = await renderApp(
    { index: HomeScreen, 'entry/_layout': EntryLayout, 'entry/[entryId]': EntryFromLinkScreen },
    {
      shell: testShell({
        userState: opened(userState),
        remoteSwitches: switchedTo(edition),
        composition: opened(composition),
      }),
      settings: { reduceMotion: false },
    },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
  const notice = screen.getByTestId('feed-notice-communityWord', { includeHiddenElements: true });
  for (let page = pageOf(notice); page > 0; page -= 1) await swipeUp();
  return { pathname: () => app.getPathname(), notice };
}

describe('the Community Word on the Feed', () => {
  it('shows «Слово тижня спільноти», the Entry and how many readers added it, with the card', async () => {
    const { notice } = await onCommunityWord();

    expect(within(notice).getByText('Слово тижня спільноти')).toBeOnTheScreen();
    expect(within(notice).getByText('до Улюбленого додали 12 читачів')).toBeOnTheScreen();
    expect(within(notice).getByText('зважати на')).toBeOnTheScreen();
    expect(within(notice).getByText('замість «приймати до уваги»')).toBeOnTheScreen();
  });

  it('opens the Entry over the Feed on a tap', async () => {
    const { pathname } = await onCommunityWord();

    await settle(() => fireEvent.press(screen.getByTestId('community-word-open')));

    expect(pathname()).toBe('/entry/c_abc123');
  });
});
