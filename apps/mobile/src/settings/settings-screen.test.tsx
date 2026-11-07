import { describe, expect, it, jest } from '@jest/globals';
import { loadEdition, type AnalyticsPort, type Edition, type FeatureSwitch } from '@slovo/core';
import { Linking } from 'react-native';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { fireEvent, screen, within } from 'expo-router/testing-library';
import { renderRoutes } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import NarratorVoiceScreen from '../app/settings/narrator-voice';
import WidgetGuideScreen from '../app/settings/widgets';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { screenSettled } from '../use-open-screen';
import {
  opened,
  recordedAnalytics,
  settingsAt,
  switchedTo,
  testShell,
} from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

// Settings reads the Account, the Hidden Entries and the Notifications through these; the rows under test need none of them.
jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../mix/hidden', () => ({ useHiddenSummary: () => '' }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

/** The Recording of the sample Word in each Narrator Voice, as the audio module gets it. */
const sampleRecordings: Record<string, number> = {
  oksana: 101,
  taras: 102,
  marta: 103,
  ostap: 104,
};
const playedRecordings: number[] = [];
jest.mock('../edition/edition', () => {
  const actual = jest.requireActual<typeof import('../edition/edition')>('../edition/edition');
  const word = actual.edition.narratorVoiceSample.word;
  return {
    ...actual,
    activeEditionFiles: {
      ...actual.activeEditionFiles,
      recordings: Object.fromEntries(
        Object.entries(sampleRecordings).map(([voice, recording]) => [
          voice,
          { [word]: recording },
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
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({ ...rest, featureSwitches: { ...featureSwitches, ...switches } });
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
) {
  // A screen an earlier test opened would hold back the next tap's.
  screenSettled();
  const settings = await settingsAt({}, analytics);
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
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

  it('keeps every row of the app under the group the board gives it', async () => {
    await renderSettings();

    const groups: Record<string, string[]> = {
      look: ['settings-theme-light', 'settings-font-size-M'],
      sound: [
        'settings-vibration',
        'settings-row-narrator-voice',
        'settings-row-notifications',
        'settings-row-widgets',
      ],
      learning: ['settings-row-my-mix', 'settings-row-hidden', 'settings-row-badges'],
      account: ['settings-row-about'],
    };
    for (const [key, rows] of Object.entries(groups)) {
      const group = screen.getByTestId(`settings-group-${key}`);
      for (const row of rows) expect(within(group).getByTestId(row)).toBeOnTheScreen();
    }
  });
});

describe('Settings › Віджети', () => {
  it('opens the widget guide from «Як додати віджет» under «ЗВУК І СПОВІЩЕННЯ», with its 3 steps', async () => {
    await renderSettings();
    expect(screen.getByText('ЗВУК І СПОВІЩЕННЯ')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Як додати віджет/ }));

    const guide = await screen.findByTestId('widget-guide');
    expect(within(guide).getByText('Слово на головному екрані')).toBeOnTheScreen();
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

  it('turns Seasonal Decor off from its switch while the Edition turns it on', async () => {
    const settings = await renderSettings({ seasonalDecor: true });

    const row = screen.getByRole('switch', { name: 'Сезонний декор' });
    expect(row).toBeChecked();
    const { title, explanation } = editionStrings.settings.seasonalDecor;
    expect(screen.getByText(explanation, { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the row once, at its switch, with the explanation as its hint.
    expect(screen.getByHintText(explanation)).toBe(row);
    expect(screen.queryByText(title)).not.toBeOnTheScreen();
    expect(screen.queryByText(explanation)).not.toBeOnTheScreen();

    await fireEvent.press(row);

    expect((await settings.read()).seasonalDecor).toBe(false);
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

describe('Settings › «Ділитися анонімною статистикою»', () => {
  it('shows its switch while the Community Counters are on and Analytics is off', async () => {
    await renderSettings({ communityCounters: true, analytics: false });

    expect(
      screen.getByTestId('settings-share-counters', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Ділитися анонімною статистикою' }),
    ).toBeOnTheScreen();
  });

  it('shows its switch while Analytics is on and the Community Counters are off', async () => {
    await renderSettings({ communityCounters: false, analytics: true });

    expect(
      screen.getByTestId('settings-share-counters', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Ділитися анонімною статистикою' }),
    ).toBeOnTheScreen();
  });

  it('turns sharing off from its switch, which stops Analytics and tells it nothing more', async () => {
    const analytics = recordedAnalytics();
    const settings = await renderSettings({}, analytics.port);

    await fireEvent.press(screen.getByRole('switch', { name: 'Ділитися анонімною статистикою' }));

    expect((await settings.read()).shareCounters).toBe(false);
    expect(analytics.stopped()).toBe(true);
    expect(analytics.events).toEqual([]);
  });

  it('turns sharing the Community Counters off from its switch, which explains what it shares', async () => {
    const settings = await renderSettings();

    const row = screen.getByRole('switch', { name: 'Ділитися анонімною статистикою' });
    expect(row).toBeChecked();
    const explanation =
      'Анонімні лічильники слів і відповідей анкети та анонімна статистика використання. Без акаунта, пошти й ідентифікатора пристрою.';
    expect(screen.getByText(explanation, { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the row once, at its switch, with the explanation as its hint.
    expect(screen.getByHintText(explanation)).toBe(row);
    expect(screen.queryByText(explanation)).not.toBeOnTheScreen();

    await fireEvent.press(row);

    expect((await settings.read()).shareCounters).toBe(false);
  });

  it("opens the Edition's privacy policy from the link under the switch", async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSettings();

    await fireEvent.press(screen.getByRole('button', { name: 'Політика приватності' }));

    expect(openURL).toHaveBeenCalledWith('https://slovo.example/uk/privacy');
  });

  it('has no switch and no link while the Edition turns Community Counters and Analytics off', async () => {
    await renderSettings({ communityCounters: false, analytics: false });

    expect(
      screen.queryByRole('switch', { name: 'Ділитися анонімною статистикою' }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Політика приватності' })).not.toBeOnTheScreen();
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
