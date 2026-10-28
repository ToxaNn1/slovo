import { describe, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import WidgetGuideScreen from '../app/settings/widgets';
import { edition, editionStrings } from '../edition/edition';

// Settings reads the composition through these; the widget's rows need none of it.
const mockUpdate = jest.fn();
jest.mock('./settings', () => ({
  useSettings: () => ({
    current: {
      theme: 'system',
      fontSize: 'M',
      hideStreak: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
    },
    update: mockUpdate,
  }),
}));
let mockSeasonalDecorSetting = false;
let mockShareCountersSetting = false;
jest.mock('../shown-in-effect', () => ({
  useShown: () => ({
    stats: undefined,
    selfCheckSetting: false,
    seasonalDecorSetting: mockSeasonalDecorSetting,
    shareCountersSetting: mockShareCountersSetting,
  }),
}));
jest.mock('../account/account', () => ({ useAccountInEffect: () => undefined }));
jest.mock('../mix/mix', () => ({ useMixSummary: () => 'Усі' }));
jest.mock('../mix/hidden', () => ({ useHiddenSummary: () => '' }));
jest.mock('../notifications/notifications', () => ({ useNotificationsSummary: () => '' }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Settings as the app routes to it, with the widget guide a push away. */
async function renderSettings() {
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <EditionProvider edition={edition} strings={editionStrings}>
            <Stack screenOptions={{ headerShown: false }} />
          </EditionProvider>
        </SafeAreaProvider>
      ),
      'settings/index': SettingsScreen,
      'settings/widgets': WidgetGuideScreen,
    },
    { initialUrl: '/settings' },
  );
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
    mockSeasonalDecorSetting = true;
    await renderSettings();

    const row = screen.getByRole('switch', { name: 'Сезонний декор' });
    expect(row).toHaveProp('value', true);
    const { title, explanation } = editionStrings.settings.seasonalDecor;
    expect(screen.getByText(explanation, { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the row once, at its switch, with the explanation as its hint.
    expect(screen.getByHintText(explanation)).toBe(row);
    expect(screen.queryByText(title)).not.toBeOnTheScreen();
    expect(screen.queryByText(explanation)).not.toBeOnTheScreen();

    await fireEvent(row, 'valueChange', false);

    expect(mockUpdate).toHaveBeenCalledWith({ seasonalDecor: false });
  });

  it('has no switch while the Edition turns Seasonal Decor off', async () => {
    mockSeasonalDecorSetting = false;
    await renderSettings();

    expect(screen.queryByRole('switch', { name: 'Сезонний декор' })).not.toBeOnTheScreen();
  });
});

describe('Settings › «Ділитися анонімною статистикою»', () => {
  it('turns sharing the Community Counters off from its switch, which explains what it shares', async () => {
    mockShareCountersSetting = true;
    await renderSettings();

    const row = screen.getByRole('switch', { name: 'Ділитися анонімною статистикою' });
    expect(row).toHaveProp('value', true);
    const explanation =
      'Лише анонімні лічильники: скільки читачів знають і зберегли слово. Без акаунта й без даних пристрою.';
    expect(screen.getByText(explanation, { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the row once, at its switch, with the explanation as its hint.
    expect(screen.getByHintText(explanation)).toBe(row);
    expect(screen.queryByText(explanation)).not.toBeOnTheScreen();

    await fireEvent(row, 'valueChange', false);

    expect(mockUpdate).toHaveBeenCalledWith({ shareCounters: false });
  });

  it("opens the Edition's privacy policy from the link under the switch", async () => {
    mockShareCountersSetting = true;
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSettings();

    await fireEvent.press(screen.getByRole('button', { name: 'Політика приватності' }));

    expect(openURL).toHaveBeenCalledWith(edition.legalPages.privacy);
  });

  it('has no switch and no link while the Edition turns Community Counters off', async () => {
    mockShareCountersSetting = false;
    await renderSettings();

    expect(
      screen.queryByRole('switch', { name: 'Ділитися анонімною статистикою' }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Політика приватності' })).not.toBeOnTheScreen();
  });
});
