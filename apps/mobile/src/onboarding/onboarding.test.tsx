import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { createSettings, openComposition, type Composition, type Edition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { opened, switchedTo, testShell } from '../shell/test-support';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { Onboarding } from './onboarding';

const { onboarding: strings } = editionStrings;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Unbounded' } } } },
}));

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

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
/** Reads «Ділитися анонімною статистикою» as the reader's device keeps it. */
let readShared: () => Promise<boolean>;

/** Draws the onboarding of a new reader over the Edition given, on 2026-10-28 in Kyiv. */
async function renderOnboarding(
  shipped: Edition = loadEdition(activeEditionFiles.config),
  region?: () => string | undefined,
) {
  const userState = await seedUserState({}, { clock });
  const settings = createSettings({ userState, defaults: shipped.userSettingDefaults });
  readShared = async () => (await settings.read()).shareCounters;
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
    ...(region === undefined ? {} : { region }),
  });
  const shell = testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(shipped),
    composition: opened(composition),
  });
  await renderApp({ index: Onboarding }, { shell });
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

// Spec #1358, ticket #1379: the onboarding of 1.0.
describe('the onboarding', () => {
  it('goes from the welcome to the first Word, «ГРАЙ!», «Рівень», «Навіщо», the Daily Goal and «Коли нагадати?», then the Feed', async () => {
    await renderOnboarding();
    expect(screen.getByText(strings.welcome.title)).toBeTruthy();

    await press('onboarding-start');
    expect(screen.getByText(strings.firstWord.title)).toBeTruthy();
    const { state } = composition.onboarding;
    if (state.status !== 'open' || state.step.kind !== 'firstWord')
      throw new Error('No first Word');
    const firstWord = state.step;
    expect(screen.getAllByText(firstWord.word.primaryDefinition).length).toBeGreaterThan(0);
    // The sample card is the Feed's tabbed card in its fixed frame.
    expect(screen.getByTestId('word-tab-panel')).toBeTruthy();

    await press('onboarding-next');
    expect(screen.getByText(strings.playStep.title)).toBeTruthy();

    await press('onboarding-next');
    expect(screen.getByText(strings.level.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Мовний гурман' })).toBeTruthy();
    await press('onboarding-answer-good');
    // «Рівень» sets no Rarity Range.
    expect(composition.rarityRange.state).toEqual({ from: 1, to: 5 });

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
    expect(screen.getByText('ДЗИНЬ!')).toBeTruthy();
    expect(screen.getByText('Коли нагадати про слово?')).toBeTruthy();
    for (const chip of ['9:00', '13:00', '20:30', 'Без нагадувань']) {
      expect(screen.getByRole('button', { name: chip })).toBeTruthy();
    }
    await press('onboarding-time-20:30');

    expect(composition.notifications.state.times).toEqual({
      kind: 'on',
      word: '20:30',
      reminder: undefined,
    });
    expect(composition.onboarding.state).toEqual({ status: 'finished', finishedAt: clock.now() });
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
    // One button goes on: no «ГОТОВО» and no test again, as from Settings.
    expect(await screen.findByText(/^(\d+) з \1 слів знайомі\./)).toBeTruthy();
    expect(screen.queryByText(editionStrings.rarityTest.again)).toBeNull();
    expect(screen.queryByText(editionStrings.rarityTest.done)).toBeNull();
    await press('onboarding-rarity-next');

    // The rarest Word asked about is of rarity 3, and the reader knows it.
    expect(composition.rarityRange.state).toEqual({ from: 1, to: 3 });
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
    expect(composition.onboarding.state).toEqual({ status: 'finished', finishedAt: clock.now() });
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
      featureSwitches: Record<string, string>;
    };
    await renderOnboarding(
      loadEdition({ ...rest, featureSwitches: { ...featureSwitches, game: 'off' } }),
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

describe('the statistics consent', () => {
  it('tells a reader outside the EEA on the welcome that statistics are on, and shows no step', async () => {
    await renderOnboarding(undefined, () => 'UA');
    expect(screen.getByTestId('onboarding-statistics-note')).toHaveTextContent(
      strings.welcome.statisticsNote,
    );
    await press('onboarding-start');
    expect(screen.queryByTestId('onboarding-statistics-consent')).toBeNull();
    expect(screen.getByTestId('onboarding-first-word')).toBeOnTheScreen();
    expect(await readShared()).toBe(true);
  });

  it('asks an EEA reader after the welcome with two equal buttons, and «Не дозволяти» keeps the switch off', async () => {
    await renderOnboarding(undefined, () => 'DE');
    expect(screen.queryByTestId('onboarding-statistics-note')).toBeNull();
    await press('onboarding-start');
    const step = within(screen.getByTestId('onboarding-statistics-consent'));
    expect(step.getByRole('header')).toHaveTextContent(strings.statisticsConsent.title);
    expect(step.getByText(strings.statisticsConsent.text)).toBeOnTheScreen();
    expect(step.getByRole('button', { name: strings.statisticsConsent.allow })).toBeOnTheScreen();
    expect(step.getByRole('button', { name: strings.statisticsConsent.deny })).toBeOnTheScreen();
    expect(await readShared()).toBe(false);

    await press('onboarding-statistics-deny');
    expect(screen.queryByTestId('onboarding-statistics-consent')).toBeNull();
    expect(screen.getByTestId('onboarding-first-word')).toBeOnTheScreen();
    expect(await readShared()).toBe(false);
  });

  it('turns the switch on when an EEA reader allows, as an unknown region does too', async () => {
    await renderOnboarding(undefined, () => undefined);
    await press('onboarding-start');
    await press('onboarding-statistics-allow');
    expect(screen.getByTestId('onboarding-first-word')).toBeOnTheScreen();
    expect(await readShared()).toBe(true);
  });
});
