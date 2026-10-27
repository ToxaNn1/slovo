import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import WidgetGuideScreen from '../app/settings/widgets';
import { edition, editionStrings } from '../edition/edition';

// Settings reads the composition through these; the widget's rows need none of it.
jest.mock('./settings', () => ({
  useSettings: () => ({
    current: { theme: 'system', fontSize: 'M', hideStreak: false, selfCheck: false },
    update: () => undefined,
  }),
}));
jest.mock('../shown-in-effect', () => ({
  useShown: () => ({ stats: undefined, selfCheckSetting: false }),
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
