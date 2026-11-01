import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  trackChanges,
  type Composition,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { Onboarding } from './onboarding';

const { onboarding: strings } = editionStrings;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { id: 'uk', wordOfTheDayFontFamily: 'Kurale' } } } },
}));

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

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

/** Draws the onboarding of a new reader over the Edition given, on 2026-10-28 in Kyiv. */
async function renderOnboarding(shipped: Edition = loadEdition(activeEditionFiles.config)) {
  const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'emotions-character', displayName: 'Емоції' }],
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
    userState: opened(trackChanges({ userState, clock })),
    remoteSwitches: switchedTo(shipped),
    composition: opened(composition),
  });
  await renderRouter(
    {
      index: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <TokensProvider tokens={editionTokens} colorScheme="light">
            <ShellProvider shell={shell}>
              <EditionProvider edition={edition} strings={editionStrings}>
                <HapticsProvider haptics={haptics}>
                  <Onboarding />
                </HapticsProvider>
              </EditionProvider>
            </ShellProvider>
          </TokensProvider>
        </SafeAreaProvider>
      ),
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// Spec #1358, ticket #1379: the onboarding of 1.0 (ADR 0067).
describe('the onboarding', () => {
  it('goes from the welcome to the first Word, «Хто ви», «Навіщо» and the Daily Goal, then the Feed', async () => {
    await renderOnboarding();
    expect(screen.getByText(strings.welcome.title)).toBeTruthy();

    await press('onboarding-start');
    expect(screen.getByText(strings.firstWord.title)).toBeTruthy();
    const firstWord = composition.onboarding.state.step;
    if (firstWord?.kind !== 'firstWord') throw new Error('No first Word');
    expect(screen.getAllByText(firstWord.word.primaryDefinition).length).toBeGreaterThan(0);

    await press('onboarding-next');
    expect(screen.getByText(strings.who.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Мовний гурман' })).toBeTruthy();
    await press('onboarding-answer-studying');
    expect(composition.mix.state.rarityCeiling).toBe(4);

    expect(screen.getByText(strings.why.title)).toBeTruthy();
    // «Пізніше» goes on and keeps the Mix kind weights.
    const weights = composition.mix.state;
    await press('onboarding-later');
    expect(composition.mix.state).toBe(weights);

    expect(screen.getByText(strings.dailyGoal.title)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: `${strings.dailyGoal.title}: 20` }).props,
    ).toMatchObject({ accessibilityState: { selected: true } });
    await press('onboarding-daily-goal-30');
    await press('onboarding-done');

    expect(composition.xpLog.state.dailyGoal?.goal).toBe(30);
    expect(composition.onboarding.state.finishedAt).toEqual(clock.now());
    expect(screen.queryByTestId('onboarding-daily-goal')).toBeNull();
  });

  it('ends at once on «Пропустити», keeping the defaults', async () => {
    await renderOnboarding();
    await press('onboarding-skip');

    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(composition.onboarding.state.finishedAt).toEqual(clock.now());
    expect(composition.xpLog.state.dailyGoal?.goal).toBe(20);
  });

  it('asks no question while the questionnaire is off', async () => {
    const shipped = loadEdition(activeEditionFiles.config);
    await renderOnboarding({
      ...shipped,
      isFeatureEnabled: (name) => name !== 'questionnaire' && shipped.isFeatureEnabled(name),
    });
    await press('onboarding-start');
    await press('onboarding-next');

    expect(screen.queryByText(strings.who.title)).toBeNull();
    expect(screen.getByText(strings.dailyGoal.title)).toBeTruthy();
  });
});
