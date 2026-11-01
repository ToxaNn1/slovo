import { describe, expect, it, jest } from '@jest/globals';
import { loadEdition, type Edition, type FeatureSwitch } from '@slovo/core';
import { Linking } from 'react-native';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import WidgetGuideScreen from '../app/settings/widgets';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

// Settings reads the Account, the Hidden Entries and the Notifications through these; the rows under test need none of them.
jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../mix/hidden', () => ({ useHiddenSummary: () => '' }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

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
 * push away. Gives the settings, which keep what the screen changes.
 */
async function renderSettings(switches: Partial<Record<FeatureSwitch, boolean>> = {}) {
  const settings = await settingsAt();
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    remoteSwitches: switchedTo(editionWith(switches)),
    settings,
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
      'settings/widgets': WidgetGuideScreen,
    },
    { initialUrl: '/settings' },
  );
  return (await settings.opened()).settings;
}

describe('Settings › Віджети', () => {
  it('opens the widget guide from «Як додати віджет» under «ВІДЖЕТИ», with its 3 steps', async () => {
    await renderSettings();
    expect(screen.getByText('ВІДЖЕТИ')).toBeOnTheScreen();

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

describe('Settings › ЗВУКИ', () => {
  it('shows only «Вібрація», with no «Звуки» or «Музика» row', async () => {
    const settings = await renderSettings();

    expect(screen.getByText('ЗВУКИ')).toBeOnTheScreen();
    expect(screen.queryByText('Звуки', { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(screen.queryByText('Музика', { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(screen.queryByText('СКОРО', { includeHiddenElements: true })).not.toBeOnTheScreen();

    await fireEvent(screen.getByRole('switch', { name: 'Вібрація' }), 'valueChange', false);

    expect((await settings.read()).vibration).toBe(false);
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
    expect(row).toHaveProp('value', true);
    const { title, explanation } = editionStrings.settings.seasonalDecor;
    expect(screen.getByText(explanation, { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the row once, at its switch, with the explanation as its hint.
    expect(screen.getByHintText(explanation)).toBe(row);
    expect(screen.queryByText(title)).not.toBeOnTheScreen();
    expect(screen.queryByText(explanation)).not.toBeOnTheScreen();

    await fireEvent(row, 'valueChange', false);

    expect((await settings.read()).seasonalDecor).toBe(false);
  });
});

describe('Settings › «Ділитися анонімною статистикою»', () => {
  it('turns sharing the Community Counters off from its switch, which explains what it shares', async () => {
    const settings = await renderSettings();

    const row = screen.getByRole('switch', { name: 'Ділитися анонімною статистикою' });
    expect(row).toHaveProp('value', true);
    const explanation =
      'Лише анонімні лічильники: скільки читачів знають і зберегли слово. Без акаунта й без даних пристрою.';
    expect(screen.getByText(explanation, { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the row once, at its switch, with the explanation as its hint.
    expect(screen.getByHintText(explanation)).toBe(row);
    expect(screen.queryByText(explanation)).not.toBeOnTheScreen();

    await fireEvent(row, 'valueChange', false);

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
    expect(row).toHaveProp('value', false);
    expect(screen.getByHintText(editionStrings.settings.noCounters.explanation)).toBe(row);
    expect(screen.queryByRole('switch', { name: 'Приховати Серію' })).not.toBeOnTheScreen();

    await fireEvent(row, 'valueChange', true);
    expect((await settings.read()).noCounters).toBe(true);

    await fireEvent(screen.getByRole('switch', { name: 'Без лічильників' }), 'valueChange', false);
    expect((await settings.read()).noCounters).toBe(false);
  });

  it('is «Приховати Серію» of 0.9 while its Feature Switch is off', async () => {
    const settings = await renderSettings({ noCounters: false });

    expect(screen.queryByRole('switch', { name: 'Без лічильників' })).not.toBeOnTheScreen();
    await fireEvent(screen.getByRole('switch', { name: 'Приховати Серію' }), 'valueChange', true);

    expect((await settings.read()).noCounters).toBe(true);
  });
});
