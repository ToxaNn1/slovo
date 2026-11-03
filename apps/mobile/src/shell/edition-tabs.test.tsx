import { describe, expect, it } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenStack } from '../entries/screen-stack';
import { edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { EditionTabs } from './edition-tabs';
import { opened, settingsAt, switchedTo, testShell } from './test-support';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The app's tabs over the shipped Edition, opened on `url`. */
async function renderTabs(url: string) {
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    settings: await settingsAt({}),
    remoteSwitches: switchedTo(edition),
  });
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <SettingsProvider>
                <EditionTabs screenOptions={{ headerShown: false }} />
              </SettingsProvider>
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      index: () => <Text>Feed</Text>,
      'game/_layout': () => <ScreenStack />,
      'game/index': () => <Text>Games</Text>,
      'game/crossword': () => <Text>Crossword</Text>,
      'saved/_layout': () => <ScreenStack />,
      'saved/index': () => <Text>Saved</Text>,
      'settings/_layout': () => <ScreenStack initialRouteName="profile" />,
      'settings/profile': () => <Text>Profile</Text>,
      'settings/index': () => <Text>Settings</Text>,
      'entry/_layout': () => <ScreenStack />,
      'entry/[entryId]': () => <Text>Entry</Text>,
      'search/_layout': () => <ScreenStack />,
      'search/index': () => <Text>Search</Text>,
    },
    { initialUrl: url },
  );
}

const tabs = editionStrings.tabs;

describe('the tab bar', () => {
  it('names the tabs as the board: «Стрічка · Ігри · Збережене · Профіль»', async () => {
    await renderTabs('/');

    expect(screen.getByText('Feed')).toBeOnTheScreen();
    for (const name of [tabs.home, tabs.game, tabs.saved, tabs.profile]) {
      expect(screen.getByText(name)).toBeVisible();
    }
  });

  it('opens the Profile on the fourth tab, and hides over Settings pushed from it', async () => {
    await renderTabs('/');
    fireEvent.press(screen.getByText(tabs.profile));
    expect(await screen.findByText('Profile')).toBeOnTheScreen();
    expect(screen.getByText(tabs.profile)).toBeVisible();

    act(() => {
      router.push('/settings');
    });

    expect(await screen.findByText('Settings')).toBeOnTheScreen();
    expect(screen.queryByText(tabs.profile)).toBeNull();
  });

  it('shows on the first screen of a tab', async () => {
    await renderTabs('/');
    fireEvent.press(screen.getByText(tabs.saved));

    expect(await screen.findByText('Saved')).toBeOnTheScreen();
    expect(screen.getByText(tabs.saved)).toBeVisible();
  });

  it.each(['/entry/w_one', '/search', '/game/crossword'])(
    'hides over a screen pushed off the tabs: %s',
    async (url) => {
      await renderTabs(url);

      expect(screen.queryByText(tabs.home)).toBeNull();
    },
  );

});
