import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  createSettings,
  openComposition,
  statisticsConsentFor,
  type Composition,
  type Edition,
  type StatisticsConsent,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import * as Speech from 'expo-speech';
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

// The installed binary has the time picker; a plain view stands in for its native one.
jest.mock('../device/device-native-modules', () => ({
  nativeModules: {
    has: () => true,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    load: () => (require('react-native') as typeof import('react-native')).View,
  },
}));
// The device's clock reads 20:35, as on the app pass.
jest.mock('../device/device-clock', () => ({
  deviceClock: { now: () => new Date(2026, 10, 27, 20, 35), timeZone: () => 'Europe/Kyiv' },
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
let readerState: Awaited<ReturnType<typeof seedUserState>>;

/** Draws the onboarding of a new reader over the Edition given, on 2026-10-28 in Kyiv, with the phone's Statistics consent. */
async function renderOnboarding(
  shipped: Edition = loadEdition(activeEditionFiles.config),
  consent?: StatisticsConsent,
) {
  const userState = await seedUserState({}, { clock });
  readerState = userState;
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
    consent,
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
  // The first Word's red gives way, and lets VoiceOver reach the step, only
  // once Reduce Motion has answered, which is after the first pass.
  await act(() => jest.runAllTimersAsync());
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
  it('goes from the welcome to the first Word, «ГОЛОС», «ГРАЙ!», «Рівень», «Навіщо», the Daily Goal and «Коли нагадати?», then the Feed', async () => {
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
    expect(screen.getByText(strings.voiceStep.title)).toBeTruthy();

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
  it('shows «ГРАЙ!» after «ГОЛОС» with the happy Mascot, and «Далі» goes on to «Рівень»', async () => {
    await renderOnboarding();
    await press('onboarding-start');
    await press('onboarding-next');
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

  it('goes from the first Word straight to «Рівень» with the Game and the Narrator Voice off', async () => {
    // Through the Edition's own switches, so `playStep` and `voiceStep` go off with what they depend on.
    const { featureSwitches, ...rest } = activeEditionFiles.config as {
      featureSwitches: Record<string, string>;
    };
    await renderOnboarding(
      loadEdition({
        ...rest,
        featureSwitches: { ...featureSwitches, game: 'off', narratorVoice: 'off' },
      }),
    );
    await press('onboarding-start');
    await press('onboarding-next');

    expect(screen.queryByTestId('onboarding-voice')).toBeNull();
    expect(screen.queryByTestId('onboarding-play')).toBeNull();
    expect(screen.getByText(strings.level.title)).toBeTruthy();
  });

  // «ГОЛОС», step 3 of 8 (design XObVoice).
  it('shows «ГОЛОС» after the first Word: a tap chooses the Narrator Voice, «ОБИРАЮ» goes on with it', async () => {
    // The sample Word is read, here with no device voice to fall back on.
    jest.spyOn(Speech, 'getAvailableVoicesAsync').mockResolvedValue([]);
    await renderOnboarding();
    await press('onboarding-start');
    await press('onboarding-next');

    const step = within(screen.getByTestId('onboarding-voice'));
    expect(step.getByText(strings.voiceStep.shout)).toBeTruthy();
    expect(step.getByRole('header', { name: strings.voiceStep.title })).toBeTruthy();
    expect(step.getByText(strings.voiceStep.subtitle)).toBeTruthy();
    expect(screen.getByLabelText('Крок 3 з 8')).toBeTruthy();
    const row = (name: string) => screen.getByRole('button', { name }).props;
    // Nothing chosen yet: the Edition's default voice is.
    expect(row('Оксана')).toMatchObject({ accessibilityState: { selected: true } });
    for (const name of ['Тарас', 'Марта', 'Остап']) {
      expect(row(name)).toMatchObject({ accessibilityState: { selected: false } });
    }

    await press('onboarding-voice-list-taras');
    expect(row('Тарас')).toMatchObject({ accessibilityState: { selected: true } });
    expect(row('Оксана')).toMatchObject({ accessibilityState: { selected: false } });

    await press('onboarding-next');
    expect(screen.getByText(strings.playStep.title)).toBeTruthy();
    const settings = createSettings({
      userState: readerState,
      defaults: loadEdition(activeEditionFiles.config).userSettingDefaults,
    });
    expect((await settings.read()).narratorVoice).toBe('taras');
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
    await press('onboarding-next');

    expect(screen.queryByText(strings.level.title)).toBeNull();
    expect(screen.getByText(strings.dailyGoal.title)).toBeTruthy();
  });

  // App pass 27.11 (B5): «Інший час» opened the picker at the time it was, 20:35.
  it("opens «Інший час» at the Edition's default time for the Word", async () => {
    await renderOnboarding();
    for (const step of [
      'onboarding-start',
      'onboarding-next',
      'onboarding-next',
      'onboarding-next',
      'onboarding-answer-good',
      'onboarding-later',
      'onboarding-done',
    ])
      await press(step);
    await press('onboarding-time-other');

    const start = screen.getByTestId('time-picker').props['value'] as Date;
    expect([start.getHours(), start.getMinutes()]).toEqual([9, 0]);
    expect(start.getDate()).toBe(27);
  });
});

// Ticket #2082; ADR 0210: a reader of the EEA is asked, any other one is told.
describe('the Statistics consent', () => {
  const shipped = loadEdition(activeEditionFiles.config);
  const consentOn: Edition = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'statisticsConsent' || shipped.isFeatureEnabled(feature),
  };
  /** Draws the onboarding of a new reader on a phone of `region`, none where the locale names none, in Kyiv time. */
  const onPhoneOf = (region: string | undefined) =>
    renderOnboarding(
      consentOn,
      statisticsConsentFor(consentOn, { region, timeZone: 'Europe/Kyiv' }),
    );
  const shares = async () =>
    (await createSettings({ userState: readerState, defaults: shipped.userSettingDefaults }).read())
      .shareCounters;

  it('tells a reader outside the EEA on the welcome that the statistics are on, and asks nothing', async () => {
    await onPhoneOf('UA');
    expect(screen.getByTestId('onboarding-statistics-line')).toHaveTextContent(
      strings.welcome.statistics,
    );

    await press('onboarding-start');

    expect(screen.queryByText(strings.statisticsConsent.title)).toBeNull();
    expect(screen.getByText(strings.firstWord.title)).toBeTruthy();
  });

  it('asks a reader of the EEA after the welcome, with two equal choices and no going on without one', async () => {
    await onPhoneOf('DE');
    expect(screen.queryByTestId('onboarding-statistics-line')).toBeNull();

    await press('onboarding-start');

    expect(screen.getByRole('header', { name: strings.statisticsConsent.title })).toBeTruthy();
    expect(screen.getByText(strings.statisticsConsent.subtitle)).toBeTruthy();
    const allow = screen.getByRole('button', { name: strings.statisticsConsent.allow });
    const deny = screen.getByRole('button', { name: strings.statisticsConsent.deny });
    expect(allow.props['style']).toBeDefined();
    expect(allow.props['style']).toEqual(deny.props['style']);
    expect(screen.queryByTestId('onboarding-next')).toBeNull();
    expect(screen.queryByTestId('onboarding-later')).toBeNull();
  });

  it('turns the statistics on when the reader allows, and goes on', async () => {
    await onPhoneOf('DE');
    await press('onboarding-start');

    await press('onboarding-statistics-allow');

    expect(await shares()).toBe(true);
    expect(screen.getByText(strings.firstWord.title)).toBeTruthy();
  });

  it('keeps the statistics off when the reader does not allow, and goes on', async () => {
    await onPhoneOf('DE');
    await press('onboarding-start');

    await press('onboarding-statistics-deny');

    expect(await shares()).toBe(false);
    expect(screen.getByText(strings.firstWord.title)).toBeTruthy();
  });

  it('asks a reader whose phone names no region', async () => {
    await onPhoneOf(undefined);
    await press('onboarding-start');

    expect(screen.getByText(strings.statisticsConsent.title)).toBeTruthy();
  });
});
