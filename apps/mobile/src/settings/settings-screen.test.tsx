import { describe, expect, it, jest } from '@jest/globals';
import {
  loadEdition,
  type AnalyticsPort,
  type Composition,
  type Edition,
  type FeatureSwitch,
} from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import DailyGoalScreen from '../app/settings/daily-goal';
import NarratorVoiceScreen from '../app/settings/narrator-voice';
import PrivacyScreen from '../app/settings/privacy';
import WidgetGuideScreen from '../app/settings/widgets';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { screenSettled } from '../use-open-screen';
import { opened, packWithMedia, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

// Settings reads the Account, the Hidden Entries and the Notifications through these; the rows under test need none of them.
jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../mix/hidden', () => ({ useHiddenSummary: () => '' }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '09:00' }));
// The installed build «Про SLOVO» names (ADR 0044).
jest.mock('../device/device-native-modules', () => {
  const { nativeModules } = jest.requireActual<typeof import('../device/device-native-modules')>(
    '../device/device-native-modules',
  );
  return {
    nativeModules: {
      ...nativeModules,
      load: <T,>(name: Parameters<typeof nativeModules.load>[0], require: () => T) =>
        name === 'application' || name === 'updates'
          ? require()
          : nativeModules.load(name, require),
    },
  };
});
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '0.9',
  nativeBuildVersion: '42',
}));
jest.mock('expo-updates', () => ({ updateId: null }));

/** The Recording of the sample Word in each Narrator Voice, as the audio module gets it. */
const sampleRecordings: Record<string, number> = {
  oksana: 101,
  taras: 102,
  marta: 103,
  ostap: 104,
};
const playedRecordings: number[] = [];

/** The pack of the test: the sample Word's live Recording row in each voice, whose file the app bundles. */
const samplePack = () =>
  packWithMedia({
    recordings: Object.keys(sampleRecordings).map((narratorVoice) => ({
      wordId: edition.narratorVoiceSample.word,
      narratorVoice,
      recordingKind: 'plain',
      hash: 'h'.repeat(64),
      size: 1_000,
      durationMs: 900,
      retired: false,
    })),
  });
jest.mock('../edition/edition', () => {
  const actual = jest.requireActual<typeof import('../edition/edition')>('../edition/edition');
  const word = actual.edition.narratorVoiceSample.word;
  return {
    ...actual,
    activeEditionFiles: {
      ...actual.activeEditionFiles,
      // Bundled by Media Store path, each the file of a row of `samplePack` below, hash `h…`.
      starterMedia: Object.fromEntries(
        Object.entries(sampleRecordings).map(([voice, recording]) => [
          `recordings/${voice}/plain/${word}.${'h'.repeat(64)}.mp3`,
          recording,
        ]),
      ),
    },
  };
});
jest.mock('../sounds/interface-sounds', () => ({
  ...jest.requireActual<object>('../sounds/interface-sounds'),
  recordingPlayer: {
    play: (recording: number) => {
      playedRecordings.push(recording);
    },
    stop: () => undefined,
  },
}));

/** The UA Edition as it ships, with the Feature Switches named set as given. */
function editionWith(switches: Partial<Record<FeatureSwitch, boolean>>): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  const states = Object.fromEntries(
    Object.entries(switches).map(([name, on]) => [name, on ? 'on' : 'off']),
  );
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...states } });
}

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Settings as the app routes to it, over the Edition in effect with the
 * switches named set as given and the settings as they ship, with the widget guide a
 * push away. Gives the settings, which keep what the screen changes and tell
 * `analytics` of them when a test gives a port.
 */
async function renderSettings(
  switches: Partial<Record<FeatureSwitch, boolean>> = {},
  analytics?: AnalyticsPort,
  composition?: Composition,
) {
  // A screen an earlier test opened would hold back the next tap's.
  screenSettled();
  const settings = await settingsAt({}, analytics);
  const shell = testShell({
    composition: opened(composition ?? (await testShell().composition.opened())),
    languagePack: samplePack(),
    remoteSwitches: switchedTo(editionWith(switches)),
    settings,
  });
  await renderRoutes(
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
      'settings/widgets': WidgetGuideScreen,
      'settings/narrator-voice': NarratorVoiceScreen,
      'settings/daily-goal': DailyGoalScreen,
      'settings/privacy': PrivacyScreen,
    },
    { initialUrl: '/settings' },
  );
  return (await settings.opened()).settings;
}

describe('Settings, as the board', () => {
  it('heads the screen with «Налаштування» and its groups as the board: look, sound, learning, account', async () => {
    await renderSettings();

    expect(screen.getByRole('header', { name: 'Налаштування' })).toBeOnTheScreen();
    const heads = screen
      .getAllByRole('header')
      .map((head): unknown => head.props['children'])
      .filter((text) => text !== 'Налаштування');
    expect(heads).toEqual(['ВИГЛЯД', 'ЗВУК І СПОВІЩЕННЯ', 'НАВЧАННЯ', 'АКАУНТ']);
  });

  it('keeps every row of the app under the group the board gives it, in its order', async () => {
    await renderSettings({
      reduceMotion: true,
      sounds: true,
      rarityCeiling: true,
      selfCheck: true,
      textSizeSteps: false,
    });

    const groups: Record<string, string[]> = {
      look: ['settings-theme-light', 'settings-reduce-motion', 'settings-font-size-M'],
      sound: [
        'settings-sounds',
        'settings-row-narrator-voice',
        'settings-vibration',
        'settings-row-notifications',
        'settings-row-widgets',
      ],
      learning: [
        'settings-row-daily-goal',
        'settings-rarity',
        'settings-row-my-mix',
        'settings-row-rarity-test',
        'settings-row-badges',
        'settings-row-questionnaire',
        'settings-row-streak-break',
        'settings-no-counters',
        'settings-self-check',
        'settings-row-hidden',
      ],
      account: ['settings-row-privacy', 'settings-row-about'],
    };
    for (const [key, rows] of Object.entries(groups)) {
      const group = screen.getByTestId(`settings-group-${key}`);
      for (const row of rows) expect(within(group).getByTestId(row)).toBeOnTheScreen();
    }
  });

  it('offers the Themes as Світла · Темна · Системна, «Світла й темна — рівноправні»', async () => {
    await renderSettings();

    const themes = screen
      .getAllByRole('button', { name: /^Тема: / })
      .map((segment): unknown => segment.props['accessibilityLabel']);
    expect(themes).toEqual(['Тема: Світла', 'Тема: Темна', 'Тема: Системна']);
    expect(
      screen.getByText('Світла й темна — рівноправні', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('shows the value of a row beside its chevron: the first Notification time', async () => {
    await renderSettings();

    const row = screen.getByRole('button', { name: 'Сповіщення, 09:00' });
    expect(row).toHaveProp('accessibilityHint', 'Нагадування про слово дня');
  });

  it('names the version and the build under «Про SLOVO»', async () => {
    await renderSettings();

    expect(screen.getByRole('button', { name: 'Про SLOVO' })).toHaveProp(
      'accessibilityHint',
      'Версія 0.9 (42)',
    );
  });

  it('gives every row a line under its title', async () => {
    await renderSettings({
      reduceMotion: true,
      sounds: true,
      rarityCeiling: true,
      selfCheck: true,
    });

    const rows = [
      ...screen
        .getAllByRole('button')
        .filter((row) => String(row.props['testID']).startsWith('settings-row-')),
      ...screen.getAllByRole('switch'),
    ];
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) expect(row.props['accessibilityHint']).toEqual(expect.any(String));
  });
});

describe('Settings › the text size (ADR 0134)', () => {
  it('keeps the S…XL row while the three-step text size is off, and it changes the font size', async () => {
    const settings = await renderSettings({ textSizeSteps: false });

    await fireEvent.press(screen.getByTestId('settings-font-size-XL'));

    expect(await settings.read()).toMatchObject({ fontSize: 'XL', textSize: 'system' });
  });

  it('has no S…XL row while the three-step text size is on', async () => {
    await renderSettings({ textSizeSteps: true });

    expect(screen.getByTestId('settings-theme-light')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-font-size-M')).toBeNull();
  });
});

describe('Settings › Віджети', () => {
  it('opens the widget guide from «Віджети», with no value, under «ЗВУК І СПОВІЩЕННЯ», with its 3 steps', async () => {
    await renderSettings();
    expect(screen.getByText('ЗВУК І СПОВІЩЕННЯ')).toBeOnTheScreen();

    const row = screen.getByRole('button', { name: 'Віджети' });
    expect(row).toHaveProp('accessibilityHint', 'Головний екран і блокування');
    await fireEvent.press(row);

    const guide = await screen.findByTestId('widget-guide');
    // Beside its back tile at the size of every screen a Settings row opens, as the board has it (owner 08.11).
    expect(
      within(guide).getByRole('header', { name: editionStrings.settings.widgets.title }),
    ).toHaveStyle({
      fontSize: 20,
      textTransform: 'none',
    });
    for (const [index, step] of editionStrings.widget.guide.steps.entries()) {
      expect(screen.getByTestId(`widget-guide-step-${String(index + 1)}`)).toHaveTextContent(
        `${String(index + 1)}${step.title}${step.hint}`,
      );
    }
  });
});

describe('Settings › ЗВУК І СПОВІЩЕННЯ', () => {
  it('turns «Звуки» off', async () => {
    const settings = await renderSettings({ sounds: true });

    await fireEvent.press(screen.getByRole('switch', { name: 'Звуки' }));

    expect((await settings.read()).sounds).toBe(false);
  });

  it('shows «Звуки» and «Вібрація», with no «Музика» row', async () => {
    const settings = await renderSettings();

    expect(screen.getByText('ЗВУК І СПОВІЩЕННЯ')).toBeOnTheScreen();
    expect(screen.queryByText('Музика', { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(screen.queryByText('СКОРО', { includeHiddenElements: true })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: 'Вібрація' }));

    expect((await settings.read()).vibration).toBe(false);
  });
});

describe('Settings › «Ціль дня»', () => {
  it('opens the screen of the Daily Goal from its row: the number, the explaining line and four options', async () => {
    await renderSettings({ dailyGoal: true });
    await fireEvent.press(screen.getByTestId('settings-row-daily-goal'));

    const goalScreen = await screen.findByTestId('daily-goal-screen');
    expect(within(goalScreen).getByRole('header', { name: 'Ціль дня' })).toBeOnTheScreen();
    expect(within(goalScreen).getByText('Скільки нових слів відкривати щодня.')).toBeOnTheScreen();
    const options = ['10', '25', '50', 'Без цілі'].map((name) =>
      within(goalScreen).getByRole('radio', { name }),
    );
    expect(within(goalScreen).getAllByRole('radio')).toEqual(options);
  });

  it('keeps the goal chosen on the screen and names it on the row', async () => {
    const composition = await testShell().composition.opened();
    await renderSettings({ dailyGoal: true }, undefined, composition);
    await fireEvent.press(screen.getByTestId('settings-row-daily-goal'));

    await fireEvent.press(await screen.findByTestId('daily-goal-25'));
    expect(screen.getByTestId('daily-goal-25')).toBeSelected();
    expect(screen.getByTestId('daily-goal-sample')).toHaveTextContent(
      '25Двадцять п’ять слів — золота середина.',
    );
    expect(composition.xpLog.state.dailyGoal?.goal).toBe(25);

    await fireEvent.press(screen.getByTestId('daily-goal-none'));
    expect(screen.getByTestId('daily-goal-sample')).toHaveTextContent(
      '—Без цілі — гортай у власному темпі.',
    );
    expect(composition.xpLog.state.dailyGoal).toBeNull();
    await fireEvent.press(screen.getByTestId('daily-goal-back'));

    expect(await screen.findByRole('button', { name: 'Ціль дня, Без цілі' })).toBeOnTheScreen();
  });

  it('leaves the row out while its Feature Switch is off', async () => {
    await renderSettings({ dailyGoal: false });

    expect(screen.queryByTestId('settings-row-daily-goal')).not.toBeOnTheScreen();
  });
});

describe('Settings › «Голос диктора»', () => {
  it('opens the voice screen from «Голос диктора» right after «Звуки», with its title and lead', async () => {
    await renderSettings();
    const group = screen.getByTestId('settings-group-sound');
    const rows = within(group)
      .getAllByTestId(/^settings-/)
      .map((row): unknown => row.props['testID']);
    expect(rows.indexOf('settings-row-narrator-voice')).toBe(rows.indexOf('settings-sounds') + 1);

    await fireEvent.press(screen.getByTestId('settings-row-narrator-voice'));

    const voiceScreen = await screen.findByTestId('narrator-voice-screen');
    expect(within(voiceScreen).getByRole('header', { name: 'Голос диктора' })).toBeOnTheScreen();
    expect(
      within(voiceScreen).getByText('Хто читає слова вголос на картці та в іграх.'),
    ).toBeOnTheScreen();
    expect(within(voiceScreen).getByTestId('narrator-voice-voice-oksana')).toBeSelected();
  });

  it('chooses a voice from its tile and reads the sample Word in it at once', async () => {
    const settings = await renderSettings();
    await fireEvent.press(screen.getByTestId('settings-row-narrator-voice'));
    playedRecordings.length = 0;

    await fireEvent.press(await screen.findByTestId('narrator-voice-voice-taras'));

    expect((await settings.read()).narratorVoice).toBe('taras');
    expect(screen.getByTestId('narrator-voice-voice-taras')).toBeSelected();
    expect(playedRecordings).toEqual([sampleRecordings['taras']]);
  });

  it('reads the sample Word in the chosen voice from the play button', async () => {
    await renderSettings();
    await fireEvent.press(screen.getByTestId('settings-row-narrator-voice'));
    await fireEvent.press(await screen.findByTestId('narrator-voice-voice-marta'));
    playedRecordings.length = 0;
    // The tap read the sample; the button stops it, then reads it again.
    await fireEvent.press(screen.getByTestId('narrator-voice-play'));
    await fireEvent.press(screen.getByTestId('narrator-voice-play'));

    expect(playedRecordings).toEqual([sampleRecordings['marta']]);
  });

  it('names the chosen voice on its row: «Оксана» as it ships, «Тарас» once chosen', async () => {
    await renderSettings();
    expect(screen.getByRole('button', { name: 'Голос диктора, Оксана' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('settings-row-narrator-voice'));
    await fireEvent.press(await screen.findByTestId('narrator-voice-voice-taras'));
    await fireEvent.press(screen.getByTestId('narrator-voice-back'));

    expect(await screen.findByRole('button', { name: 'Голос диктора, Тарас' })).toBeOnTheScreen();
  });

  it('leaves the row out while its Feature Switch is off', async () => {
    await renderSettings({ narratorVoice: false });

    expect(screen.queryByTestId('settings-row-narrator-voice')).not.toBeOnTheScreen();
  });
});

describe('Settings › «Сезонний декор»', () => {
  it('has no switch in the UA Edition, which pauses Seasonal Decor', async () => {
    await renderSettings();

    expect(screen.queryByRole('switch', { name: 'Сезонний декор' })).not.toBeOnTheScreen();
  });

  it('has no row even while the Edition turns Seasonal Decor on (ADR 0055)', async () => {
    await renderSettings({ seasonalDecor: true });

    expect(screen.queryByTestId('settings-seasonal-decor')).not.toBeOnTheScreen();
  });
});

describe('Settings › «Менше руху»', () => {
  it('turns «Менше руху» on from its switch while its Feature Switch is on', async () => {
    const settings = await renderSettings({ reduceMotion: true });

    const row = screen.getByRole('switch', { name: 'Менше руху' });
    expect(row).not.toBeChecked();
    expect(screen.getByHintText(editionStrings.settings.reduceMotion.explanation)).toBe(row);

    await fireEvent(row, 'valueChange', true);

    expect((await settings.read()).reduceMotion).toBe(true);
  });

  it('leaves the switch out while its Feature Switch is off', async () => {
    await renderSettings({ reduceMotion: false });

    expect(
      screen.queryByTestId('settings-reduce-motion', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });
});

describe('Settings › «Конфіденційність»', () => {
  it('replaces the privacy switch with a row that opens the privacy screen', async () => {
    await renderSettings();

    expect(
      screen.queryByRole('switch', { name: 'Ділитися анонімною статистикою' }),
    ).not.toBeOnTheScreen();
    const row = screen.getByTestId('settings-row-privacy');
    expect(within(row).getByText('Конфіденційність', { includeHiddenElements: true })).toBeTruthy();
    expect(
      within(row).getByText('Дані та статистика', { includeHiddenElements: true }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Конфіденційність' }));

    expect(await screen.findByTestId('privacy')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Анонімна статистика' })).toBeOnTheScreen();
  });

  it('shows its row with the Data export alone on', async () => {
    await renderSettings({ communityCounters: false, analytics: false, dataExport: true });

    expect(screen.getByTestId('settings-row-privacy')).toBeTruthy();
  });

  it('has no row while the Edition turns the Community Counters, Analytics and the Data export off', async () => {
    await renderSettings({ communityCounters: false, analytics: false, dataExport: false });

    expect(screen.queryByTestId('settings-row-privacy')).not.toBeOnTheScreen();
  });
});

describe('Settings › «Без лічильників»', () => {
  it('turns the counters off and on again from its switch, which says that counting goes on', async () => {
    const settings = await renderSettings();

    const row = screen.getByRole('switch', { name: 'Без лічильників' });
    expect(row).not.toBeChecked();
    expect(screen.getByHintText(editionStrings.settings.noCounters.explanation)).toBe(row);
    expect(screen.queryByRole('switch', { name: 'Приховати Серію' })).not.toBeOnTheScreen();

    await fireEvent.press(row);
    expect((await settings.read()).noCounters).toBe(true);

    await fireEvent.press(screen.getByRole('switch', { name: 'Без лічильників' }));
    expect((await settings.read()).noCounters).toBe(false);
  });

  it('is «Приховати Серію» of 0.9 while its Feature Switch is off', async () => {
    const settings = await renderSettings({ noCounters: false });

    expect(screen.queryByRole('switch', { name: 'Без лічильників' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Приховати Серію' }));

    expect((await settings.read()).noCounters).toBe(true);
  });
});

describe('Settings › Значки', () => {
  it('shows the «Значки» row while its switch is on, and no «Профіль» row: the Profile is a tab', async () => {
    await renderSettings();

    expect(screen.getByTestId('settings-row-badges')).toBeOnTheScreen();
    // The back tile names the Profile; no row of the list opens it.
    expect(screen.queryByTestId('settings-row-profile')).not.toBeOnTheScreen();
  });

  it('shows no «Значки» row while the Edition turns the Badges off', async () => {
    await renderSettings({ badges: false });

    expect(screen.queryByTestId('settings-row-badges')).not.toBeOnTheScreen();
  });
});
