import { fill, ScreenEnter, TabBarButton, type IconName } from '@slovo/ui';
import { Tabs, useIsFocused } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';

import { editionStrings } from '@/edition/edition';
import { useGameState } from '@/game/game';
import type { Tab } from '@/shown';
import { useShown } from '@/shown-in-effect';

const { tabs } = editionStrings;

/** Each tab's icon of the design's set. */
const tabIcons = {
  home: 'feed',
  game: 'games',
  saved: 'saved',
  settings: 'profile',
} as const satisfies Record<Tab, IconName>;

type TabOptions = Exclude<
  ComponentProps<typeof Tabs>['screenOptions'],
  ((...args: never[]) => unknown) | undefined
>;
type TabButtonProps = Parameters<NonNullable<TabOptions['tabBarButton']>>[0];
type ScreenLayoutProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['screenLayout']>>[0];

/**
 * A tab's `name`, test id and button among the tabs shown in their order. Its
 * VoiceOver label counts the tabs shown only, not the hidden routes beside
 * them, in the Edition's language. A tab not shown has no button.
 */
function tabOptions(tab: Tab, tabOrder: readonly Tab[], name: string) {
  if (!tabOrder.includes(tab)) return { href: null };
  return {
    title: name,
    tabBarButtonTestID: `tab-${tab}`,
    tabBarAccessibilityLabel: fill(tabs.accessibilityLabel, {
      tab: name,
      position: String(tabOrder.indexOf(tab) + 1),
      count: String(tabOrder.length),
    }),
    tabBarButton: ({
      onPress,
      onLongPress,
      testID,
      style,
      'aria-label': ariaLabel,
      'aria-selected': ariaSelected,
    }: TabButtonProps) => (
      <TabBarButton
        icon={tabIcons[tab]}
        label={name}
        selected={ariaSelected === true}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={ariaLabel}
        testID={testID}
        style={style}
      />
    ),
  };
}

type TabRoute = Parameters<typeof getFocusedRouteNameFromRoute>[0];

/** Whether a tab's stack is on its first screen, `first`, the one its tab button opens. */
function atRoot(route: TabRoute, first = 'index'): boolean {
  return (getFocusedRouteNameFromRoute(route) ?? first) === first;
}

/** The tab bar as the screen options draw it, or hidden. */
function barShown(shown: boolean, style: TabOptions['tabBarStyle']) {
  return { tabBarStyle: shown ? style : [style, { display: 'none' as const }] };
}

/**
 * A screen of the tabs, entering as the design has it each time it gains
 * focus. Its focus is read from the navigation state on each render, so no
 * focus is missed between the first render and a subscription.
 */
function FocusedEnter({ route, children }: Pick<ScreenLayoutProps, 'route' | 'children'>) {
  const focused = useIsFocused();
  return (
    <ScreenEnter focused={focused} testID={`${route.name}-enter`}>
      {children}
    </ScreenEnter>
  );
}

/**
 * The tabs the Edition shows in effect, in their final order: the Game's goes
 * and comes back with its Feature Switch, also one turned off remotely while
 * the app runs (ADR 0040). As the boards, the tab bar shows only on a tab's
 * first screen and hides over everything a tab or a link pushes: an Entry,
 * Search, the Daily Crossword, a Game's Round and its result.
 */
export function EditionTabs({ screenOptions }: { screenOptions: TabOptions }) {
  const shown = useShown();
  const tabOrder = shown.tabs;
  // The fourth tab is the Profile while it is shown, Settings otherwise.
  const names = { ...tabs, settings: shown.profile ? tabs.profile : tabs.settings };
  /** While a Game is on, its Round or its result fills the Game tab. */
  const gameOn = useGameState().current !== undefined;
  const tab = (name: Tab, onRoot = true) => ({
    ...tabOptions(name, tabOrder, names[name]),
    ...barShown(onRoot, screenOptions.tabBarStyle),
  });
  const offTabs = { href: null, ...barShown(false, screenOptions.tabBarStyle) };
  return (
    <Tabs
      screenOptions={screenOptions}
      screenLayout={({ route, children }) => <FocusedEnter route={route}>{children}</FocusedEnter>}
    >
      <Tabs.Screen name="index" options={tab('home')} />
      <Tabs.Screen name="game" options={({ route }) => tab('game', atRoot(route) && !gameOn)} />
      <Tabs.Screen name="saved" options={({ route }) => tab('saved', atRoot(route))} />
      <Tabs.Screen
        name="settings"
        options={({ route }) => tab('settings', atRoot(route, shown.profile ? 'profile' : 'index'))}
      />
      {/* An Entry opened from a link, such as a notification's; no tab leads to it. */}
      <Tabs.Screen name="entry" options={offTabs} />
      {/* The recipient sheet of a Collection Link opened from outside; no tab leads to it. */}
      <Tabs.Screen name="c/[linkId]" options={offTabs} />
      {/* The Feed, from the Dashboard; with `dashboard` off the home is the Feed itself. */}
      <Tabs.Screen
        name="feed"
        options={{ href: null, ...barShown(true, screenOptions.tabBarStyle) }}
      />
      {/* A Correction Type's screen, from its tile on the Dashboard; no tab leads to it. */}
      <Tabs.Screen name="correction-type/[type]" options={offTabs} />
      {/* A Curated Collection's screen, from its card on the Dashboard; no tab leads to it. */}
      <Tabs.Screen name="curated-collection/[collectionId]" options={offTabs} />
      {/* Search, from the magnifier of the «Стрічка» header; no tab leads to it. */}
      <Tabs.Screen name="search" options={offTabs} />
    </Tabs>
  );
}
