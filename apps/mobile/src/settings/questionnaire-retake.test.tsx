import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  loadEdition,
  openComposition,
  systemRandom,
  type Composition,
  type Edition,
  type FeatureSwitch,
  LATER_QUESTIONS,
  type Haptics,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider, HapticsProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import QuestionnaireScreen from '../app/settings/questionnaire';
import { LaterQuestionNotice } from '../feed/later-question-notice';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../use-open-screen';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

/**
 * The UA Edition as it ships, with «Що тобі цікаво?» on, the Feature
 * Switches `off` given off and, given one, the Daily Goal a reader has until they choose one.
 */
function shippedEdition({ off = [] }: { off?: readonly FeatureSwitch[] } = {}): Edition {
  const { featureSwitches, userSettingDefaults, ...rest } = config as {
    featureSwitches: Record<string, string>;
    userSettingDefaults: Record<string, unknown>;
  };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      account: 'off',
      interestsQuestion: 'on',
      ...Object.fromEntries(off.map((feature) => [feature, 'off'])),
    },
    userSettingDefaults,
  });
}

/** The UA Edition as it ships, with the Feature Switches given off. */
const editionWithout = (...off: FeatureSwitch[]) => shippedEdition({ off });

/** The Edition the shell reads in effect. */
let editionInEffect: Edition;

/** The composition the shell reads, opened afresh for each test. */
let composition: Composition;

jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

const haptics: Haptics = {
  selection: () => undefined,
  impactLight: () => undefined,
  impactMedium: () => undefined,
  success: () => undefined,
  warning: () => undefined,
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const { settings, feedNotices } = editionStrings;

/** Lets the Core's reads and writes and the renders after them finish. */
async function settle() {
  for (let turn = 0; turn < 10; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openWith(edition: Edition) {
  editionInEffect = edition;
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' },
        { id: 'food', displayName: 'Їжа', description: 'Їжа.', tone: 'loud' },
      ],
      words: [],
    }),
    edition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

/** Settings as the app routes to it, with the questionnaire a push away, and the Feed Notice of `notice`. */
async function render(notice?: Parameters<typeof LaterQuestionNotice>[0]['question']) {
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionInEffect),
    settings: await settingsAt(),
  });
  await renderRoutes(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <HapticsProvider haptics={haptics}>
                <SettingsProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                </SettingsProvider>
              </HapticsProvider>
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      'settings/index': SettingsScreen,
      'settings/questionnaire': QuestionnaireScreen,
      notice: () => (notice === undefined ? null : <LaterQuestionNotice question={notice} />),
    },
    { initialUrl: notice === undefined ? '/settings' : '/notice' },
  );
  await settle();
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
  await settle();
}

beforeEach(async () => {
  await openWith(editionWithout());
});

describe('Settings › «Анкета: підлаштувати Стрічку»', () => {
  it('is the board’s one screen: «Рівень» with no «Не знаю», «Навіщо», the self-rating and the interests', async () => {
    await render();
    screenSettled();
    await press(settings.rows.questionnaire);

    expect(screen.getByText(settings.questionnaireRetake.title)).toBeTruthy();
    expect(screen.getByTestId('questionnaire-level-good')).toBeTruthy();
    expect(screen.queryByTestId('questionnaire-level-dont-know')).toBeNull();
    expect(screen.getByTestId('questionnaire-why-rare-words')).toBeTruthy();
    expect(screen.getByTestId('questionnaire-selfRating-many')).toBeTruthy();
    expect(screen.getByTestId('questionnaire-interest-food')).toBeTruthy();
  });

  it('writes the answers on «ГОТОВО» and nothing when left without it', async () => {
    await render();
    screenSettled();
    const ceiling = composition.rarityRange.state.to;
    const categoryIds = composition.mix.state.categoryIds;

    await press(settings.rows.questionnaire);
    await press('Знаю дуже багато');
    await fireEvent.press(screen.getByTestId('questionnaire-interest-food'));
    await settle();
    await fireEvent.press(screen.getByTestId('questionnaire-back'));
    await settle();
    expect(composition.rarityRange.state.to).toBe(ceiling);
    expect(composition.mix.state.categoryIds).toEqual(categoryIds);

    screenSettled();
    await press(settings.rows.questionnaire);
    // The self-rating only decides whether to offer the Rarity Test (ADR 0072).
    await press('Знаю дуже багато');
    await fireEvent.press(screen.getByTestId('questionnaire-interest-food'));
    await press(settings.questionnaireRetake.done);
    expect(composition.rarityRange.state).toEqual({ from: 1, to: 5 });
    expect(composition.mix.state.categoryIds).toEqual(['nature']);
    expect(composition.mix.state.hiddenCategories.map(({ id }) => id)).toEqual(['food']);
    expect(screen.queryByTestId('questionnaire')).toBeNull();
  });

  it('starts from the last answers, so the reader sees what they chose before (owner, 18.11)', async () => {
    await render();
    await act(async () => {
      await composition.questionnaire.answer('level', 'good');
      await composition.questionnaire.answer('selfRating', 'many');
      await composition.rarityRange.set({ from: 2, to: 3 });
    });
    screenSettled();

    await press(settings.rows.questionnaire);
    await settle();

    expect(
      screen.getByTestId('questionnaire-level-good').props['accessibilityState'],
    ).toMatchObject({
      selected: true,
    });
    expect(
      screen.getByTestId('questionnaire-selfRating-many').props['accessibilityState'],
    ).toMatchObject({ selected: true });
    expect(
      screen.getByTestId('questionnaire-why-rare-words').props['accessibilityState'],
    ).toMatchObject({ selected: false });

    // «ГОТОВО» applies no answer left as it was, so the Rarity Range set since stays.
    await press(settings.questionnaireRetake.done);
    expect(composition.rarityRange.state).toEqual({ from: 2, to: 3 });
  });

  it('applies the answers once when «ГОТОВО» is tapped twice before they are written', async () => {
    await render();
    screenSettled();
    const write = composition.questionnaire.answer.bind(composition.questionnaire);
    let written: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      written = resolve;
    });
    // The write is held until both taps are in.
    const answer = jest
      .spyOn(composition.questionnaire, 'answer')
      .mockImplementation((question, answerId) => held.then(() => write(question, answerId)));

    await press(settings.rows.questionnaire);
    await press('Знаю дуже багато');
    const done = screen.getByTestId('questionnaire-done');
    await fireEvent.press(done);
    await fireEvent.press(done);
    written();
    await settle();

    expect(answer).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('questionnaire')).toBeNull();
  });

  it('has no «Рівень» and «Навіщо» while the questionnaire is off, and the self-rating still', async () => {
    await openWith(editionWithout('questionnaire'));
    await render();
    screenSettled();
    await press(settings.rows.questionnaire);

    expect(screen.queryByTestId('questionnaire-level-good')).toBeNull();
    expect(screen.queryByTestId('questionnaire-why-rare-words')).toBeNull();
    expect(screen.getByTestId('questionnaire-selfRating-many')).toBeTruthy();
  });

  it('has no interests while «Що тобі цікаво?» is off', async () => {
    await openWith(editionWithout('interestsQuestion'));
    await render();
    screenSettled();
    await press(settings.rows.questionnaire);

    expect(screen.getByTestId('questionnaire-level-good')).toBeTruthy();
    expect(screen.queryByText(feedNotices.laterQuestions.interests.title)).toBeNull();
    expect(screen.queryByTestId('questionnaire-interest-food')).toBeNull();
  });

  it('is not in Settings while the questionnaire, the Rarity Test and «Що тобі цікаво?» are off', async () => {
    await openWith(editionWithout('questionnaire', 'rarityTest', 'interestsQuestion'));
    await render();

    expect(
      screen.queryByRole('button', { name: new RegExp(settings.rows.questionnaire) }),
    ).toBeNull();
  });
});

describe('The Feed Notice of a later question', () => {
  it('sets the Daily Goal picked, the Edition’s highlighted goal until the reader picks another', async () => {
    await openWith(shippedEdition());
    await render('wordGoalChoice');
    expect(screen.getByTestId('later-question-daily-goal-10')).toBeSelected();

    await fireEvent.press(screen.getByTestId('later-question-daily-goal-50'));
    await press(feedNotices.laterQuestions.done);

    expect(composition.xpLog.state.dailyGoal?.goal).toBe(50);
  });

  it('asks the self-rating on tiles as the Game’s options, and a tile pressed is picked and answers (owner, 16.11)', async () => {
    await openWith(shippedEdition());
    const answer = jest.spyOn(composition.questionnaire, 'answer');
    await render('selfRating');
    const { options } = composition.questionnaire;

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    for (const { id, label } of options.selfRating) {
      expect(screen.getByRole('button', { name: label })).not.toBeSelected();
      expect(screen.getByTestId(`later-question-selfRating-${id}-face`)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: feedNotices.laterQuestions.later })).toBeTruthy();

    const [first] = options.selfRating;
    if (first === undefined) throw new Error('The Edition has no self-rating answer');
    await fireEvent.press(screen.getByRole('button', { name: first.label }));
    await settle();

    expect(screen.getByRole('button', { name: first.label })).toBeSelected();
    expect(answer).toHaveBeenCalledWith('selfRating', first.id);
  });

  it.each(LATER_QUESTIONS)(
    'fills its page as the Quick Question does, and %s scrolls inside its card (owner, 16.11)',
    async (question) => {
      await openWith(shippedEdition());
      await render(question);

      const card = screen.getByTestId(`feed-notice-${question}`);
      expect(within(card).getByTestId(`feed-notice-${question}-scroll`).type).toBe('RCTScrollView');
      expect(
        within(card).getByRole('button', { name: feedNotices.laterQuestions.later }),
      ).toBeTruthy();
    },
  );
});
