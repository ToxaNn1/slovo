import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { loadEdition, openComposition, type Composition, type Haptics } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { screenSettled } from '../use-open-screen';
import { Onboarding } from './onboarding';

const { onboarding: strings } = editionStrings;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Unbounded' } } } },
}));

const clock = { now: () => new Date('2026-11-04T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

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

let composition: Composition;

/** The app of a new reader on 2026-11-04 in Kyiv: the home, with the Onboarding over it as the root layout draws it. */
async function renderApp() {
  const shipped = loadEdition(activeEditionFiles.config);
  const userState = await seedUserState({}, { clock });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: Array.from({ length: 8 }, (_, index) =>
        word(`w_${String(index)}`, `слово${String(index)}`),
      ),
    }),
    edition: shipped,
    userState,
    clock,
    random: { next: () => 0 },
  });
  const shell = testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(shipped),
    composition: opened(composition),
  });
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <SettingsProvider>
                    <Slot />
                    <Onboarding />
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
}

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

const press = (testID: string) => settle(() => fireEvent.press(screen.getByTestId(testID)));

/** The shout of every Onboarding step, in the order the reader meets them. */
const shouts = [
  strings.welcome.shout,
  strings.firstWord.shout,
  strings.playStep.shout,
  strings.level.shout,
  strings.why.shout,
  strings.dailyGoal.shout,
  strings.notificationTime.shout,
];

/** Expects step `number` of the seven on screen, under its shout and no other. */
function expectStep(number: number) {
  const shout = shouts[number - 1] ?? '';
  expect(screen.getByLabelText(`Крок ${String(number)} з ${String(shouts.length)}`)).toBeTruthy();
  expect(screen.getByText(shout)).toBeTruthy();
  for (const other of shouts.filter((each) => each !== shout)) {
    expect(screen.queryByText(other)).toBeNull();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

// Spec #1553, ticket #1562: the whole onboarding flow lands on the home, the Dashboard (ADR 0076).
describe('the whole onboarding flow', () => {
  it('walks СЛОВО → ПЕРШЕ → ГРАЙ! → РІВЕНЬ? → НАВІЩО? → ЦІЛЬ → НАГАДУВАННЯ and lands on the Dashboard', async () => {
    await renderApp();
    // The Onboarding covers the home: a modal over it hides it from the reader.
    expect(screen.queryByTestId('dashboard')).toBeNull();
    expect(shouts).toEqual([
      'СЛОВО',
      'ПЕРШЕ',
      'ГРАЙ!',
      'РІВЕНЬ?',
      'НАВІЩО?',
      'ЦІЛЬ',
      'НАГАДУВАННЯ',
    ]);

    expectStep(1);
    expect(screen.getByText(strings.welcome.title)).toBeTruthy();
    await press('onboarding-start');

    expectStep(2);
    expect(screen.getByTestId('onboarding-first-word')).toBeTruthy();
    await press('onboarding-next');

    expectStep(3);
    expect(screen.getByTestId('onboarding-play')).toBeTruthy();
    await press('onboarding-next');

    expectStep(4);
    expect(screen.getByText(strings.level.title)).toBeTruthy();
    await press('onboarding-answer-good');

    expectStep(5);
    expect(screen.getByText(strings.why.title)).toBeTruthy();
    await press('onboarding-later');

    expectStep(6);
    expect(screen.getByTestId('onboarding-daily-goal')).toBeTruthy();
    await press('onboarding-done');

    expectStep(7);
    expect(screen.getByTestId('onboarding-notification-time')).toBeTruthy();
    await press('onboarding-time-20:30');

    // The Dashboard: nothing covers it.
    expect(composition.onboarding.state.finishedAt).toEqual(clock.now());
    for (const shout of shouts) expect(screen.queryByText(shout)).toBeNull();
    expect(screen.queryByTestId('onboarding-notification-time')).toBeNull();
    expect(screen.getByTestId('dashboard')).toBeTruthy();
  });
});
