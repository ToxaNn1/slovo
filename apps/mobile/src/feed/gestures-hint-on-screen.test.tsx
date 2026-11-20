import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { Slot } from 'expo-router';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo, Pressable } from 'react-native';

import HomeScreen from '../app/feed';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { useShowGesturesHintAgain } from './gestures-hint';

const { config } = activeEditionFiles;

const onOff = (on: boolean) => (on ? 'on' : 'off');

/**
 * The UA Edition with the side swipes marking an Entry as the Knowledge switch
 * says, and the hint playing its demo as `gesturesHintDemo` says.
 */
function editionWith(knowledge: boolean, gesturesHintDemo = true): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      knowledge: onOff(knowledge),
      gesturesHintDemo: onOff(gesturesHintDemo),
    },
  });
}

/** The UA Edition in effect. */
let editionInEffect: Edition;

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

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

/** Opens the composition over two Words. */
async function open(knowledge: boolean, gesturesHintDemo = true) {
  editionInEffect = editionWith(knowledge, gesturesHintDemo);
  // Onboarding finished weeks ago: nothing covers the Feed, and its first week is over.
  userState = await seedUserState({ onboardingFinished: '2026-09-01T09:00:00.000Z' }, { clock });
  await reopen();
}

/** Opens the composition afresh over the same user state, as on the next launch. */
async function reopen() {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: [word('w_sumyrnyi', 'сумирний'), word('w_lahidnyi', 'лагідний')],
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
  // Reduce Motion on: the finger's demo loops for as long as the sheet is open,
  // which settling every timer would never finish. Its motion is tested in @slovo/ui.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  motionPlays = false;
  jest.useRealTimers();
  screenSettled();
});

/** Whether motion plays: the demo then loops for good, so settling runs a while, not every timer. */
let motionPlays = false;

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await (motionPlays ? jest.advanceTimersByTimeAsync(2000) : jest.runAllTimersAsync());
  });
}

/** The Shell the app draws under: the settings and the composition over the test's user state. */
const shell = () =>
  testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(editionInEffect),
    composition: opened(composition),
  });

/** Settings' «Показати підказку жестів», beside the Feed. */
function ShowAgain() {
  const showAgain = useShowGesturesHintAgain();
  return <Pressable testID="show-again" onPress={() => void showAgain()} />;
}

/** The app on the Feed. */
async function openApp() {
  await renderApp(
    {
      _layout: () => (
        <>
          <Slot />
          <ShowAgain />
        </>
      ),
      index: HomeScreen,
    },
    { shell: shell() },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

describe('the gestures hint sheet on the Feed', () => {
  it('shows «ГОРТАЙ ПАЛЬЦЕМ» with its three rows on the first launch ', async () => {
    await open(true);
    await openApp();
    await settle();
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    // The board's texts in «ти» (ADR 0092).
    expect(screen.getByText('ГОРТАЙ ПАЛЬЦЕМ')).toBeOnTheScreen();
    expect(screen.getByText('Вправо — знаю')).toBeOnTheScreen();
    expect(screen.getByText('Вліво — не знаю')).toBeOnTheScreen();
    expect(screen.getByText('Вгору — наступне слово')).toBeOnTheScreen();
    expect(screen.getByText('Нове слово — коли захочеш.')).toBeOnTheScreen();
  });

  it('goes on «ЗРОЗУМІЛО» and stays gone after a restart', async () => {
    await open(true);
    await openApp();
    await settle(() => fireEvent.press(screen.getByTestId('gestures-hint-dismiss')));
    // The sheet slides away.
    await waitFor(() => {
      expect(screen.queryByTestId('gestures-hint')).toBeNull();
    });
    await screen.unmount();
    screenSettled();
    await reopen();
    await openApp();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint')).toBeNull();
  });

  it('comes back on the open Feed after «Показати підказку жестів», once it was dismissed', async () => {
    await open(true);
    await openApp();
    await settle(() => fireEvent.press(screen.getByTestId('gestures-hint-dismiss')));
    await waitFor(() => {
      expect(screen.queryByTestId('gestures-hint')).toBeNull();
    });

    await settle(() => fireEvent.press(screen.getByTestId('show-again')));

    await waitFor(() => {
      expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    });
  });

  it('is shown once: not on the next launch even when it was not dismissed', async () => {
    await open(true);
    await openApp();
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    await screen.unmount();
    screenSettled();
    await reopen();
    await openApp();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint')).toBeNull();
  });

  it('shows no hint at all with the Knowledge switch off', async () => {
    await open(false);
    await openApp();
    expect(screen.getByTestId('feed')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint')).toBeNull();
    expect(screen.queryByText('ГОРТАЙ ПАЛЬЦЕМ')).toBeNull();
  });
});

// Board XSwipeV: the hint plays the Feed's real card under a finger (ADR 0112).
describe("the swipe hint's demo on the Feed", () => {
  beforeEach(() => {
    motionPlays = true;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  it('drags a finger over the card with gesturesHintDemo on', async () => {
    await open(true, true);
    await openApp();
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    expect(screen.getByTestId('gestures-hint-finger')).toBeOnTheScreen();
  });

  it('shows the sheet without a finger with gesturesHintDemo off', async () => {
    await open(true, false);
    await openApp();
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    expect(screen.getByText('ГОРТАЙ ПАЛЬЦЕМ')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint-finger')).toBeNull();
  });
});
