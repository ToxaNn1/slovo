import { describe, expect, it, jest } from '@jest/globals';
import { loadEdition, type Edition, type FeatureSwitch } from '@slovo/core';
import { Linking } from 'react-native';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import SettingsScreen from '../app/settings';
import WidgetGuideScreen from '../app/settings/widgets';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

// Settings reads the Account, the Hidden Entries and the Notifications through these; the rows under test need none of them.
jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../mix/hidden', () => ({ useHiddenSummary: () => '' }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

/** The Ukrainian Edition as it ships, with the Feature Switches named turned off. */
function editionWithout(switchedOff: readonly FeatureSwitch[]): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: {
      ...featureSwitches,
      ...Object.fromEntries(switchedOff.map((name) => [name, false])),
    },
  });
}

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Settings as the app routes to it, over the Edition in effect with the
 * switches named off and the settings as they ship, with the widget guide a
 * push away. Gives the settings, which keep what the screen changes.
 */
async function renderSettings(switchedOff: readonly FeatureSwitch[] = []) {
  const settings = await settingsAt();
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    remoteSwitches: switchedTo(editionWithout(switchedOff)),
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

describe('Settings › «Сезонний декор»', () => {
  it('turns Seasonal Decor off from its switch, which explains what it changes', async () => {
    const settings = await renderSettings();

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

  it('has no switch while the Edition turns Seasonal Decor off', async () => {
    await renderSettings(['seasonalDecor']);

    expect(screen.queryByRole('switch', { name: 'Сезонний декор' })).not.toBeOnTheScreen();
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

    expect(openURL).toHaveBeenCalledWith(edition.legalPages.privacy);
  });

  it('has no switch and no link while the Edition turns Community Counters off', async () => {
    await renderSettings(['communityCounters']);

    expect(
      screen.queryByRole('switch', { name: 'Ділитися анонімною статистикою' }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Політика приватності' })).not.toBeOnTheScreen();
  });
});
