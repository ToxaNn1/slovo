import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  type Composition,
  type Edition,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider, TokensProvider } from '@slovo/ui';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, edition, editionStrings, editionTokens } from '../edition/edition';
import { Onboarding } from './onboarding';

const { onboarding: strings } = editionStrings;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Unbounded' } } } },
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
  await renderRoutes(
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
  it('goes from the welcome to the first Word, «ГРАЙ!», «Рівень», «Навіщо», the Daily Goal and «Коли нагадати?», then the Feed', async () => {
    await renderOnboarding();
    expect(screen.getByText(strings.welcome.title)).toBeTruthy();

    await press('onboarding-start');
    expect(screen.getByText(strings.firstWord.title)).toBeTruthy();
    const firstWord = composition.onboarding.state.step;
    if (firstWord?.kind !== 'firstWord') throw new Error('No first Word');
    expect(screen.getAllByText(firstWord.word.primaryDefinition).length).toBeGreaterThan(0);

    await press('onboarding-next');
    expect(screen.getByText(strings.playStep.title)).toBeTruthy();

    await press('onboarding-next');
    expect(screen.getByText(strings.level.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Мовний гурман' })).toBeTruthy();
    await press('onboarding-answer-good');
    expect(composition.rarityCeiling.state).toBe(4);

    expect(screen.getByText(strings.why.title)).toBeTruthy();
    // Owner test pass B-003: «Пізніше» sits right under the options, not pinned to the bottom.
    expect(
      within(screen.getByTestId('onboarding-content')).getByTestId('onboarding-later'),
    ).toBeTruthy();
    // «Пізніше» goes on and keeps the Mix kind weights.
    const weights = composition.mix.state;
    await press('onboarding-later');
    expect(composition.mix.state).toBe(weights);

    expect(screen.getByText(strings.dailyGoal.title)).toBeTruthy();
    const goal = (xp: number) =>
      screen.getByRole('button', { name: `${String(xp)} ${strings.dailyGoal.unit}` }).props;
    expect(goal(10)).toMatchObject({ accessibilityState: { selected: true } });
    await press('onboarding-daily-goal-25');
    expect(goal(25)).toMatchObject({ accessibilityState: { selected: true } });
    expect(goal(10)).toMatchObject({ accessibilityState: { selected: false } });
    await press('onboarding-done');

    expect(composition.xpLog.state.dailyGoal?.goal).toBe(25);
    expect(screen.getByText('НАГАДУВАННЯ')).toBeTruthy();
    expect(screen.getByText('Коли нагадати?')).toBeTruthy();
    for (const chip of ['9:00', '13:00', '20:30', 'Без нагадувань']) {
      expect(screen.getByRole('button', { name: chip })).toBeTruthy();
    }
    await press('onboarding-time-20:30');

    expect(composition.notifications.state.times).toEqual(['20:30']);
    expect(composition.onboarding.state.finishedAt).toEqual(clock.now());
    expect(screen.queryByTestId('onboarding-daily-goal')).toBeNull();
  });

  it('opens the Rarity Test with «Не знаю» in the «Рівень» frame, and its result goes on to «Навіщо»', async () => {
    await renderOnboarding();
    await press('onboarding-start');
    await press('onboarding-next');
    await press('onboarding-next');
    await press('onboarding-answer-dont-know');

    expect(screen.getByText(strings.level.shout)).toBeTruthy();
    while (screen.queryByTestId('onboarding-rarity-question') !== null) {
      await press('onboarding-rarity-known');
    }
    await press('onboarding-rarity-next');

    expect(composition.rarityCeiling.state).toBe(5);
    expect(screen.getByText(strings.why.title)).toBeTruthy();
  });

  it('poses the Mascot per step as the design does, with no line, and none with its Feature Switch off', async () => {
    const shipped = loadEdition(activeEditionFiles.config);
    await renderOnboarding();
    expect(screen.getByTestId('mascot-shouts')).not.toHaveTextContent(shipped.mascot.onboarding);
    await press('onboarding-start');
    expect(screen.queryByTestId('mascot-shouts')).toBeNull();
    expect(screen.getByTestId('mascot-happy')).toBeTruthy();

    await renderOnboarding({
      ...shipped,
      isFeatureEnabled: (feature) => feature !== 'mascot' && shipped.isFeatureEnabled(feature),
    });
    expect(screen.queryByTestId('mascot-shouts')).toBeNull();
  });

  it('ends at once on «Пропустити», setting no Daily Goal', async () => {
    await renderOnboarding();
    await press('onboarding-skip');

    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(composition.onboarding.state.finishedAt).toEqual(clock.now());
    expect(composition.xpLog.state.dailyGoal).toBeNull();
  });

  // Spec #1553, ticket #1558: «ГРАЙ!» shows the Games after the first Word.
  it('shows «ГРАЙ!» after the first Word with the happy Mascot, and «Далі» goes on to «Рівень»', async () => {
    await renderOnboarding();
    await press('onboarding-start');
    await press('onboarding-next');

    const play = within(screen.getByTestId('onboarding-play'));
    expect(play.getByText(strings.playStep.shout)).toBeTruthy();
    expect(play.getByRole('header', { name: strings.playStep.title })).toBeTruthy();
    expect(play.getByText(strings.playStep.subtitle)).toBeTruthy();
    expect(screen.getByTestId('mascot-happy')).toBeTruthy();
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();

    await press('onboarding-next');
    expect(screen.getByText(strings.level.title)).toBeTruthy();
  });

  it('goes from the first Word straight to «Рівень» with the Game off', async () => {
    // Through the Edition's own switches, so `playStep` goes off with the Game it depends on.
    const { featureSwitches, ...rest } = activeEditionFiles.config as {
      featureSwitches: Record<string, boolean>;
    };
    await renderOnboarding(
      loadEdition({ ...rest, featureSwitches: { ...featureSwitches, game: false } }),
    );
    await press('onboarding-start');
    await press('onboarding-next');

    expect(screen.queryByTestId('onboarding-play')).toBeNull();
    expect(screen.getByText(strings.level.title)).toBeTruthy();
  });

  it('asks no question while the questionnaire is off', async () => {
    const shipped = loadEdition(activeEditionFiles.config);
    await renderOnboarding({
      ...shipped,
      isFeatureEnabled: (name) => name !== 'questionnaire' && shipped.isFeatureEnabled(name),
    });
    await press('onboarding-start');
    await press('onboarding-next');
    await press('onboarding-next');

    expect(screen.queryByText(strings.level.title)).toBeNull();
    expect(screen.getByText(strings.dailyGoal.title)).toBeTruthy();
  });
});
