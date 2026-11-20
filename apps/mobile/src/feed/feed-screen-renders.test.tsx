import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  openComposition,
  type Clock,
  type Composition,
  type Edition,
  type TrackedUserState,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import HomeScreen from '../app/feed';
import { activeEditionFiles } from '../edition/edition';
import { type Shell } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

// The app in the foreground, where the Feed is in sight.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

/** How many times the Feed screen rendered: it reads the Feed once a render. */
let mockScreenRenders = 0;
jest.mock('./feed', () => {
  const actual: typeof import('./feed') = jest.requireActual('./feed');
  return {
    ...actual,
    useFeed: (...args: Parameters<typeof actual.useFeed>) => {
      mockScreenRenders += 1;
      return actual.useFeed(...args);
    },
  };
});

const clock: Clock = { now: () => new Date(Date.now()), timeZone: () => 'Europe/Kyiv' };

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

let userState: TrackedUserState;
let composition: Composition;
let editionInEffect: Edition;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-03T09:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

/** Lets the screen and the Core settle, a second on the clock. */
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.advanceTimersByTimeAsync(1000);
  });
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

/** The app on the Feed over five Words, past the onboarding and its gestures hint. */
async function openApp() {
  editionInEffect = loadEdition(activeEditionFiles.config);
  userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z', gesturesHintShown: true },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [
        word('w_sumyrnyi', 'сумирний'),
        word('w_lahidnyi', 'лагідний'),
        word('w_veselyi', 'веселий'),
        word('w_khmurnyi', 'хмурний'),
        word('w_zhvavyi', 'жвавий'),
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
  const shell: Shell = testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });
  await renderApp({ index: HomeScreen }, { shell });
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

describe('the Feed screen on a swipe (perf pass, 19.11)', () => {
  it('renders once when the swipe brings the Feed a new card, and not at all otherwise', async () => {
    await openApp();

    const swipes: { position: number; newCard: boolean; renders: number }[] = [];
    for (let swipe = 0; swipe < 4; swipe += 1) {
      const before = mockScreenRenders;
      const cardsBefore = composition.feed.cards;
      await swipeUp();
      swipes.push({
        position: composition.feed.position,
        newCard: composition.feed.cards !== cardsBefore,
        renders: mockScreenRenders - before,
      });
    }

    // The first swipe turns to the card the Feed already had ready after the
    // Word of the Day; each one after it gets the next card ready.
    expect(swipes).toEqual([
      { position: 1, newCard: false, renders: 0 },
      { position: 2, newCard: true, renders: 1 },
      { position: 3, newCard: true, renders: 1 },
      { position: 4, newCard: true, renders: 1 },
    ]);
  });
});
