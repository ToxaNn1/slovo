import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Edition } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenStack } from '../entries/screen-stack';
import { screenSettled } from '../use-open-screen';
import { edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { EditionTabs } from './edition-tabs';
import { opened, settingsAt, switchedTo, testShell } from './test-support';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The app's tabs over `editionInEffect` (the shipped Edition by default), opened on `url`. */
async function renderTabs(url: string, editionInEffect: Edition = edition) {
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    settings: await settingsAt({}),
    remoteSwitches: switchedTo(editionInEffect),
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

/** The test ids of the tab buttons on screen, in their order. */
function tabButtons() {
  return screen.getAllByTestId(/^tab-[a-z]+$/).map((button) => String(button.props['testID']));
}

/** Runs an action, and lets the navigators finish it. */
async function settle(action: () => unknown) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

describe('the tab bar', () => {
  it('names the tabs as the board: «Стрічка · Ігри · Збережене · Профіль»', async () => {
    await renderTabs('/');

    expect(screen.getByText('Feed')).toBeOnTheScreen();
    for (const name of [tabs.home, tabs.game, tabs.saved, tabs.profile]) {
      expect(screen.getByText(name)).toBeVisible();
    }
  });

  it('shows four tabs in order while the Game is on', async () => {
    await renderTabs('/');

    expect(tabButtons()).toEqual(['tab-home', 'tab-game', 'tab-saved', 'tab-settings']);
  });

  it('shows three tabs, without «Ігри», while the Game is off', async () => {
    await renderTabs('/', {
      ...edition,
      isFeatureEnabled: (feature) => feature !== 'game' && edition.isFeatureEnabled(feature),
    });

    expect(tabButtons()).toEqual(['tab-home', 'tab-saved', 'tab-settings']);
    expect(screen.queryByText(tabs.game)).toBeNull();
  });

  it('opens the Profile on the fourth tab', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.profile)));

    expect(await screen.findByText('Profile')).toBeOnTheScreen();
    expect(screen.getByText(tabs.profile)).toBeVisible();
  });

  it('shows on the first screen of a tab', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.saved)));

    expect(await screen.findByText('Saved')).toBeOnTheScreen();
    expect(screen.getByText(tabs.saved)).toBeVisible();
  });

  it.each([
    ['/entry/w_one', 'Entry'],
    ['/search', 'Search'],
    ['/game/crossword', 'Crossword'],
    ['/settings', 'Settings'],
  ])('hides over a screen pushed off the tabs: %s', async (url, shown) => {
    await renderTabs(url);

    expect(await screen.findByText(shown)).toBeOnTheScreen();
    expect(screen.queryByText(tabs.home)).toBeNull();
  });
});

/** How far a tab's screen still stands off its place as it enters. */
function shiftOf(tab: string) {
  return (
    getAnimatedStyle(screen.getByTestId(`${tab}-enter-content`)) as {
      transform?: { translateX?: number }[];
    }
  ).transform?.find((step) => step.translateX !== undefined)?.translateX;
}

describe('the entrance of a tab', () => {
  it('brings the Feed to rest on the first open', async () => {
    await renderTabs('/');
    await settle(() => undefined);

    expect(shiftOf('index')).toBe(0);
  });

  it('brings a tab to rest each time it is opened again', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.saved)));
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));
    // The tab comes back on screen a step after the press; its entrance runs from there.
    await settle(() => undefined);

    expect(shiftOf('index')).toBe(0);
  });
});
