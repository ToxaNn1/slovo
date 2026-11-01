import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DailyGoal } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  systemRandom,
  type Composition,
  type Edition,
  type FeatureSwitch,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import QuestionnaireScreen from '../app/settings/questionnaire';
import { LaterQuestionNotice } from '../feed/later-question-notice';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { screenSettled } from '../entries/use-open-screen';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

/**
 * The UA Edition as it ships, with the Feature Switches `off` given off and,
 * given one, the Daily Goal a reader has until they choose one.
 */
function shippedEdition({
  off = [],
  dailyGoal,
}: { off?: readonly FeatureSwitch[]; dailyGoal?: DailyGoal } = {}): Edition {
  const { featureSwitches, userSettingDefaults, ...rest } = config as {
    featureSwitches: Record<string, boolean>;
    userSettingDefaults: Record<string, unknown>;
  };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      account: false,
      ...Object.fromEntries(off.map((feature) => [feature, false])),
    },
    userSettingDefaults:
      dailyGoal === undefined ? userSettingDefaults : { ...userSettingDefaults, dailyGoal },
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
        { id: 'nature', displayName: 'Природа' },
        { id: 'food', displayName: 'Їжа' },
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
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <SettingsProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </SettingsProvider>
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

describe('Settings › «Пройти опитування ще раз»', () => {
  it('retakes «Хто ви», the self-rating and the interests, each applied to the Mix', async () => {
    await render();
    screenSettled();
    await press(settings.rows.questionnaire);

    expect(screen.getByTestId('questionnaire-who-studying')).toBeTruthy();
    expect(screen.getByTestId('questionnaire-why-rare-words')).toBeTruthy();
    await press('Знаю дуже багато');
    expect(composition.mix.state.rarityFloor).toBe(3);

    await fireEvent.press(screen.getByTestId('questionnaire-interest-food'));
    await press(feedNotices.laterQuestions.done);
    expect(composition.mix.state.categoryIds).toEqual(['nature']);
    expect(composition.mix.state.hiddenCategories.map(({ id }) => id)).toEqual(['food']);
  });

  it('has no «Хто ви» and «Навіщо» while the questionnaire is off, and the self-rating still', async () => {
    await openWith(editionWithout('questionnaire'));
    await render();
    screenSettled();
    await press(settings.rows.questionnaire);

    expect(screen.queryByTestId('questionnaire-who-studying')).toBeNull();
    expect(screen.queryByTestId('questionnaire-why-rare-words')).toBeNull();
    expect(screen.getByTestId('questionnaire-selfRating-many')).toBeTruthy();
  });

  it('is not in Settings while the questionnaire and the Rarity Floor are off', async () => {
    await openWith(editionWithout('questionnaire', 'rarityFloor'));
    await render();

    expect(
      screen.queryByRole('button', { name: new RegExp(settings.rows.questionnaire) }),
    ).toBeNull();
  });
});

describe('The Feed Notice of a later question', () => {
  it("sets the Daily Goal picked, the Edition's default until the reader picks another", async () => {
    await openWith(shippedEdition({ dailyGoal: 30 }));
    await render('dailyGoalChoice');
    expect(screen.getByTestId('later-question-daily-goal-30')).toBeSelected();

    await fireEvent.press(screen.getByTestId('later-question-daily-goal-50'));
    await press(feedNotices.laterQuestions.done);

    expect(composition.xpLog.state.dailyGoal?.goal).toBe(50);
  });

  it('keeps the Rarity Floor as it was with «Пізніше» on the self-rating', async () => {
    await composition.mix.setRarityFloor(2);
    await render('selfRating');

    await press(feedNotices.laterQuestions.later);

    expect(composition.mix.state.rarityFloor).toBe(2);
  });
});
