import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Edition } from '@slovo/core';
import { renderApp } from './test-app';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { router, useIsFocused } from 'expo-router';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { motion } from '@slovo/ui/tokens';

import { ScreenStack } from '../entries/screen-stack';
import { screenSettled } from '../use-open-screen';
import { editionStrings } from '../edition/edition';
import { editionAtLaunch as edition } from '../edition/edition-at-launch';
import * as settingsLayout from '../app/settings/_layout';
import { EditionTabs } from './edition-tabs';
import { opened, settingsAt, switchedTo, testShell } from './test-support';

/** The home indicator of an iPhone with Face ID. */
const insets = { top: 0, left: 0, right: 0, bottom: 34 };

/** The app's tabs over `editionInEffect` (the shipped Edition by default), opened on `url`. */
async function renderTabs(
  url: string,
  editionInEffect: Edition = edition,
  screens: Record<string, () => ReactNode> = {},
) {
  const shell = testShell({
    composition: opened(await testShell().composition.opened()),
    settings: await settingsAt({}),
    remoteSwitches: switchedTo(editionInEffect),
  });
  await renderApp(
    {
      _layout: () => <EditionTabs screenOptions={{ headerShown: false }} />,
      index: () => <Text>Feed</Text>,
      feed: () => <Text>Feed opened</Text>,
      'game/_layout': () => <ScreenStack />,
      'game/index': () => <Text>Games</Text>,
      'game/crossword': () => <Text>Crossword</Text>,
      'mix/_layout': () => <ScreenStack />,
      'mix/index': () => <Text>My Mix</Text>,
      'saved/_layout': () => <ScreenStack />,
      'saved/index': () => <Text>Saved</Text>,
      'settings/_layout': settingsLayout,
      'settings/profile': () => <Text>Profile</Text>,
      'settings/index': () => <Text>Settings</Text>,
      'entry/_layout': () => <ScreenStack />,
      'entry/[entryId]': () => <Text>Entry</Text>,
      'search/_layout': () => <ScreenStack />,
      'search/index': () => <Text>Search</Text>,
      'search/[entryId]': () => <Text>Entry from Search</Text>,
      'correction-type/[type]': () => <Text>Correction Type</Text>,
      'curated-collection/[collectionId]': () => <Text>Curated Collection</Text>,
      'curated-collections': () => <Text>Curated Collections</Text>,
      'curated-collection-feed/[collectionId]': () => <Text>Curated Collection Feed</Text>,
      categories: () => <Text>Categories</Text>,
      'category/[categoryId]': () => <Text>Category</Text>,
      'category-feed/[categoryId]': () => <Text>Category Feed</Text>,
      'correction-categories': () => <Text>Correction Categories</Text>,
      'correction-category/[categoryId]': () => <Text>Correction Category</Text>,
      ...screens,
    },
    { shell, initialUrl: url, insets },
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
  it('names the tabs as the board: «Стрічка · Ігри · Мікс · Збережене · Профіль»', async () => {
    await renderTabs('/');

    expect(screen.getByText('Feed')).toBeOnTheScreen();
    for (const name of [tabs.home, tabs.game, tabs.mix, tabs.saved, tabs.profile]) {
      expect(screen.getByText(name)).toBeVisible();
    }
  });

  it('shows five tabs in order, «Мікс» in the centre, while the Game is on (ADR 0201)', async () => {
    await renderTabs('/');

    expect(tabButtons()).toEqual(['tab-home', 'tab-game', 'tab-mix', 'tab-saved', 'tab-settings']);
  });

  it('shows four tabs, without «Ігри», while the Game is off', async () => {
    await renderTabs('/', {
      ...edition,
      isFeatureEnabled: (feature) => feature !== 'game' && edition.isFeatureEnabled(feature),
    });

    expect(tabButtons()).toEqual(['tab-home', 'tab-mix', 'tab-saved', 'tab-settings']);
    expect(screen.queryByText(tabs.game)).toBeNull();
  });

  it('shows the four tabs of before, without «Мікс», while the mixTab switch is off', async () => {
    await renderTabs('/', {
      ...edition,
      isFeatureEnabled: (feature) => feature !== 'mixTab' && edition.isFeatureEnabled(feature),
    });

    expect(tabButtons()).toEqual(['tab-home', 'tab-game', 'tab-saved', 'tab-settings']);
    expect(screen.queryByText(tabs.mix)).toBeNull();
  });

  it('opens «Мій Мікс» on the centre tab, with the tab bar over it', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.mix)));

    expect(await screen.findByText('My Mix')).toBeOnTheScreen();
    expect(screen.getByText(tabs.mix)).toBeVisible();
  });

  it('reads the centre tab to VoiceOver as the third of five', async () => {
    await renderTabs('/');

    expect(screen.getByTestId('tab-mix').props['accessibilityLabel']).toBe(
      `${tabs.mix}, вкладка 3 з 5`,
    );
  });

  it('opens the Profile on the fourth tab', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.profile)));

    expect(await screen.findByText('Profile')).toBeOnTheScreen();
    expect(screen.getByText(tabs.profile)).toBeVisible();
  });

  it('opens the Profile after a Settings screen was opened from the Feed', async () => {
    await renderTabs('/feed', edition, { 'settings/mix': () => <Text>Mix settings</Text> });
    await settle(() => {
      router.push('/settings/mix');
    });
    expect(await screen.findByText('Mix settings')).toBeOnTheScreen();
    await settle(() => {
      router.back();
    });
    await settle(() => fireEvent.press(screen.getByText(tabs.profile)));

    expect(await screen.findByText('Profile')).toBeOnTheScreen();
  });

  it('opens Settings on the fourth tab while the Profile is off', async () => {
    await renderTabs('/', {
      ...edition,
      isFeatureEnabled: (feature) => feature !== 'profile' && edition.isFeatureEnabled(feature),
    });
    await settle(() => fireEvent.press(screen.getByText(editionStrings.settings.title)));

    expect(await screen.findByText('Settings')).toBeOnTheScreen();
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
    ['/correction-type/surzhyk', 'Correction Type'],
    ['/curated-collection/cc_one', 'Curated Collection'],
    ['/curated-collections', 'Curated Collections'],
    ['/curated-collection-feed/cc_one', 'Curated Collection Feed'],
    ['/categories', 'Categories'],
    ['/category/emotions-character', 'Category'],
    ['/category-feed/emotions-character', 'Category Feed'],
    ['/correction-categories', 'Correction Categories'],
    ['/correction-category/everyday', 'Correction Category'],
    ['/game/crossword', 'Crossword'],
    ['/settings', 'Settings'],
  ])('hides over a screen pushed off the tabs: %s', async (url, shown) => {
    await renderTabs(url);

    expect(await screen.findByText(shown)).toBeOnTheScreen();
    expect(screen.queryByText(tabs.home)).toBeNull();
  });

  it.each([
    ['/correction-type/surzhyk', 'Correction Type'],
    ['/curated-collection/cc_one', 'Curated Collection'],
    ['/curated-collections', 'Curated Collections'],
    ['/curated-collection-feed/cc_one', 'Curated Collection Feed'],
    ['/categories', 'Categories'],
    ['/category/emotions-character', 'Category'],
    ['/category-feed/emotions-character', 'Category Feed'],
    ['/correction-categories', 'Correction Categories'],
    ['/correction-category/everyday', 'Correction Category'],
  ])('opens a screen off the tabs from the Dashboard: %s', async (url, shown) => {
    await renderTabs('/');
    await settle(() => {
      router.push(url);
    });

    expect(await screen.findByText(shown)).toBeOnTheScreen();
  });
});

type Node = ReturnType<typeof screen.getByText>;

/** The styles of `node` and the views that hold it, from the node outwards. */
function stylesAround(node: Node) {
  const styles = [];
  for (let at: Node | null = node; at !== null; at = at.parent)
    styles.push(StyleSheet.flatten(at.props['style'] as Parameters<typeof StyleSheet.flatten>[0]));
  return styles;
}

/** The room the views around `node` keep under it. */
function roomUnder(node: Node): number {
  return stylesAround(node).reduce(
    (room, style) => room + (typeof style?.paddingBottom === 'number' ? style.paddingBottom : 0),
    0,
  );
}

describe('the room of the tab bar (owner, 16.11)', () => {
  // The tabs, 56 points, sit 12 points lower than the navigator's bar of 49 over the home indicator put them.
  const bar = 49 + 34 - 12;

  it('sits 12 points lower, over the screens, which keep their height when a push hides it', async () => {
    await renderTabs('/');

    expect(stylesAround(screen.getByTestId('tab-home'))).toContainEqual(
      expect.objectContaining({ position: 'absolute', height: bar }),
    );
  });

  it.each([
    ['/', 'Feed'],
    ['/feed', 'Feed opened'],
    ['/saved', 'Saved'],
    ['/game', 'Games'],
    ['/settings/profile', 'Profile'],
  ])('keeps the first screen of a tab clear of it: %s', async (url, shown) => {
    await renderTabs(url);

    expect(roomUnder(await screen.findByText(shown))).toBe(bar);
  });

  it.each([
    ['/game/crossword', 'Crossword'],
    ['/settings', 'Settings'],
    ['/entry/w_one', 'Entry'],
    ['/categories', 'Categories'],
  ])('gives a screen it hides over the whole height: %s', async (url, shown) => {
    await renderTabs(url);

    expect(roomUnder(await screen.findByText(shown))).toBe(0);
  });
});

/** The shipped Edition with the «Стрічка» tab leading to the Dashboard, as it used to. */
const feedTabOff: Edition = {
  ...edition,
  isFeatureEnabled: (feature) => feature !== 'feedTab' && edition.isFeatureEnabled(feature),
};

describe('the «Стрічка» tab', () => {
  it('opens the Feed from the Dashboard', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));

    expect(await screen.findByText('Feed opened')).toBeVisible();
    expect(screen.queryByText('Feed')).toBeNull();
  });

  it('opens the Feed from another tab', async () => {
    await renderTabs('/saved');
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));

    expect(await screen.findByText('Feed opened')).toBeVisible();
    expect(screen.queryByText('Feed')).toBeNull();
  });

  it('keeps the Feed on a tap on the Feed', async () => {
    await renderTabs('/feed');
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));

    expect(screen.getByText('Feed opened')).toBeVisible();
    expect(screen.queryByText('Feed')).toBeNull();
  });

  it('brings the reader back to the Feed they left, not a new one', async () => {
    function FeedAt() {
      const [card, setCard] = useState(0);
      return (
        <Text
          onPress={() => {
            setCard((at) => at + 1);
          }}
        >{`Card ${String(card)}`}</Text>
      );
    }
    await renderTabs('/feed', edition, { feed: FeedAt });
    await settle(() => fireEvent.press(screen.getByText('Card 0')));
    await settle(() => fireEvent.press(screen.getByText('Card 1')));
    await settle(() => fireEvent.press(screen.getByText(tabs.game)));
    await settle(() => undefined);

    await settle(() => fireEvent.press(screen.getByText(tabs.home)));

    expect(screen.getByText('Card 2')).toBeVisible();
  });

  it('shows as selected while the Feed is on screen', async () => {
    await renderTabs('/');
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));

    expect(await screen.findByText('Feed opened')).toBeVisible();
    expect(screen.getByTestId('tab-home')).toBeSelected();
  });

  it('shows as selected when the app opens on the Feed', async () => {
    await renderTabs('/feed');

    expect(await screen.findByText('Feed opened')).toBeVisible();
    expect(screen.getByTestId('tab-home')).toBeSelected();
    expect(screen.getByTestId('tab-saved')).not.toBeSelected();
  });

  it('shows as not selected once another tab is opened from the Feed', async () => {
    await renderTabs('/feed');
    await settle(() => fireEvent.press(screen.getByText(tabs.saved)));

    expect(await screen.findByText('Saved')).toBeVisible();
    expect(screen.getByTestId('tab-home')).not.toBeSelected();
    expect(screen.getByTestId('tab-saved')).toBeSelected();
  });

  it('shows as not selected over the Feed with the Feed tab off', async () => {
    await renderTabs('/feed', feedTabOff);

    expect(await screen.findByText('Feed opened')).toBeVisible();
    expect(screen.getByTestId('tab-home')).not.toBeSelected();
  });

  it('opens the Dashboard with the Feed tab off', async () => {
    await renderTabs('/feed', feedTabOff);
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));

    expect(await screen.findByText('Feed')).toBeVisible();
  });
});

/** How far a tab's screen still stands off its place as it enters. */
/** Opens each of `hrefs` in turn, as a tap on a tile or a card pushes it. */
async function openInTurn(...hrefs: string[]) {
  for (const href of hrefs) {
    await settle(() => {
      router.push(href);
    });
  }
}

describe('the way back from a screen no tab leads to (owner 15.11)', () => {
  it('leads from a Word of a Category back to the Category, not to the Dashboard', async () => {
    await renderTabs('/');
    await openInTurn('/category/arts', '/category-feed/arts?from=w_1');
    await settle(() => {
      router.back();
    });

    expect(screen.getByText('Category')).toBeVisible();
  });

  it('leads from a Correction of a Category back to the Category', async () => {
    await renderTabs('/');
    await openInTurn('/correction-category/grammar', '/search/c_1?back=Grammar');
    await settle(() => {
      router.back();
    });

    expect(screen.getByText('Correction Category')).toBeVisible();
  });

  it('leads from a Category back to the Categories it was opened from', async () => {
    await renderTabs('/');
    await openInTurn('/categories', '/category/arts');
    await settle(() => {
      router.back();
    });

    expect(screen.getByText('Categories')).toBeVisible();
  });

  it('leads from Search back to the Feed it was opened from', async () => {
    await renderTabs('/');
    await openInTurn('/feed', '/search');
    await settle(() => {
      router.back();
    });

    expect(screen.getByText('Feed opened')).toBeVisible();
  });

  it('leads back from a screen of another tab to the Dashboard last', async () => {
    await renderTabs('/');
    await openInTurn('/category/arts', '/category-feed/arts?from=w_1');
    await settle(() => {
      router.back();
    });
    await settle(() => {
      router.back();
    });

    expect(screen.getByText('Feed')).toBeVisible();
  });
});

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
    await renderTabs('/', feedTabOff);
    await settle(() => fireEvent.press(screen.getByText(tabs.saved)));
    await settle(() => fireEvent.press(screen.getByText(tabs.home)));
    // The tab comes back on screen a step after the press; its entrance runs from there.
    await settle(() => undefined);

    expect(shiftOf('index')).toBe(0);
  });
});

/** A value the Saved screen of the test reads, as a screen reads a source of the Core. */
function counterSource() {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: () => value,
    bump() {
      value += 1;
      for (const listener of listeners) listener();
    },
  };
}

describe('a tab out of sight (memory pass, 19.11)', () => {
  it('stays still while what it shows changes, and catches up when it comes back', async () => {
    const source = counterSource();
    let renders = 0;
    function SavedReading() {
      renders += 1;
      const value = useSyncExternalStore(source.subscribe, source.read);
      return <Text>{`Saved ${String(value)}`}</Text>;
    }
    await renderTabs('/saved', edition, { 'saved/index': SavedReading });
    await settle(() => fireEvent.press(screen.getByText(tabs.profile)));
    // The Saved goes into hiding once the Profile has entered.
    await settle(() => undefined);

    const before = renders;
    await settle(() => {
      source.bump();
      source.bump();
    });
    expect(renders).toBe(before);

    await settle(() => fireEvent.press(screen.getByText(tabs.saved)));
    expect(screen.getByText('Saved 2')).toBeVisible();
  });

  it('stays in sight until the screen that took its place has entered (27.11 pass)', async () => {
    const source = counterSource();
    let renders = 0;
    function SavedReading() {
      renders += 1;
      const value = useSyncExternalStore(source.subscribe, source.read);
      return <Text>{`Saved ${String(value)}`}</Text>;
    }
    await renderTabs('/saved', edition, { 'saved/index': SavedReading });
    await act(async () => {
      await fireEvent.press(screen.getByText(tabs.profile));
      await jest.advanceTimersByTimeAsync(motion.screen.duration / 2);
    });

    const midway = renders;
    await act(async () => {
      source.bump();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(renders).toBeGreaterThan(midway);

    await settle(() => undefined);
    const atRest = renders;
    await settle(() => {
      source.bump();
    });
    expect(renders).toBe(atRest);
  });

  it('learns it is out of sight before it stays still', async () => {
    const seen: boolean[] = [];
    function SavedFocus() {
      const focused = useIsFocused();
      seen.push(focused);
      return <Text>Saved</Text>;
    }
    await renderTabs('/saved', edition, { 'saved/index': SavedFocus });
    await settle(() => fireEvent.press(screen.getByText(tabs.profile)));

    expect(seen.at(-1)).toBe(false);
  });
});
