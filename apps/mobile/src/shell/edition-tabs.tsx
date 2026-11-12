import { fill, ScreenEnter, TabBarButton, type IconName } from '@slovo/ui';
import { router, Tabs, useIsFocused, usePathname } from 'expo-router';
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
/**
 * A tab with no button: no tab leads to its screen, a link opens it. Expo
 * Router 58 turns `href: null` into a hidden tab that sends its own focus
 * back to the first tab, so no link could open it; a hidden button keeps the
 * screen reachable, as `href: null` did before.
 */
export const noTabButton = { tabBarItemStyle: { display: 'none' } } as const;

type TabButtonProps = Parameters<NonNullable<TabOptions['tabBarButton']>>[0];
type ScreenLayoutProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['screenLayout']>>[0];

/**
 * A tab's `name`, test id and button among the tabs shown in their order. Its
 * VoiceOver label counts the tabs shown only, not the hidden routes beside
 * them, in the Edition's language. A tab not shown has no button. A button
 * shows as selected while its tab is focused, or while `alsoSelected` holds.
 */
function tabOptions(tab: Tab, tabOrder: readonly Tab[], name: string, alsoSelected: boolean) {
  if (!tabOrder.includes(tab)) return noTabButton;
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
        selected={ariaSelected === true || alsoSelected}
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

/** A tab's route as its screen options get it: without a key until it is in the navigation state. */
type DescribedRoute = Omit<TabRoute, 'key'> & { readonly key: string | undefined };

/** Whether the route is in the navigation state yet, so it has a key. */
function inState(route: DescribedRoute): route is DescribedRoute & { readonly key: string } {
  return route.key !== undefined;
}

/**
 * Whether a tab's stack is on its first screen, `first`, the one its tab button opens.
 * A route not yet in the navigation state has no stack of its own, so it is on its first screen.
 */
function atRoot(route: DescribedRoute, first = 'index'): boolean {
  return !inState(route) || (getFocusedRouteNameFromRoute(route) ?? first) === first;
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
  /** With `feedTab` on, «Стрічка» shows as selected over the Feed it opens (ADR 0093). */
  const pathname = usePathname();
  const feedSelected = shown.feedTab && pathname === '/feed';
  const tab = (name: Tab, onRoot = true, alsoSelected = false) => ({
    ...tabOptions(name, tabOrder, names[name], alsoSelected),
    ...barShown(onRoot, screenOptions.tabBarStyle),
  });
  const offTabs = { ...noTabButton, ...barShown(false, screenOptions.tabBarStyle) };
  return (
    <Tabs
      screenOptions={screenOptions}
      screenLayout={({ route, children }) => <FocusedEnter route={route}>{children}</FocusedEnter>}
    >
      <Tabs.Screen
        name="index"
        options={tab('home', true, feedSelected)}
        listeners={{
          tabPress: (event) => {
            // The Dashboard stays the home at launch; its tab opens the Feed (ADR 0093).
            if (!shown.feedTab) return;
            event.preventDefault();
            router.navigate('/feed');
          },
        }}
      />
      <Tabs.Screen name="game" options={({ route }) => tab('game', atRoot(route) && !gameOn)} />
      <Tabs.Screen name="saved" options={({ route }) => tab('saved', atRoot(route))} />
      <Tabs.Screen
        name="settings"
        options={({ route }) => tab('settings', atRoot(route, shown.profile ? 'profile' : 'index'))}
        listeners={({ route }) => ({
          tabPress: (event) => {
            // Expo Router 58 builds a tab's stack from the route files alone, before the
            // layout's `initialRouteName` is read, so the first press on the tab would open
            // Settings under no Profile. While the Profile is shown it opens the Profile.
            const stackBuilt = getFocusedRouteNameFromRoute(route) !== undefined;
            if (!shown.profile || stackBuilt) return;
            event.preventDefault();
            router.navigate('/settings/profile');
          },
        })}
      />
      {/* An Entry opened from a link, such as a notification's; no tab leads to it. */}
      <Tabs.Screen name="entry" options={offTabs} />
      {/* The recipient sheet of a Collection Link opened from outside; no tab leads to it. */}
      <Tabs.Screen name="c/[linkId]" options={offTabs} />
      {/* The Feed, from the Dashboard; with `dashboard` off the home is the Feed itself. */}
      <Tabs.Screen
        name="feed"
        options={{ ...noTabButton, ...barShown(true, screenOptions.tabBarStyle) }}
      />
      {/* A Correction Type's screen, from its tile on the Dashboard; no tab leads to it. */}
      <Tabs.Screen name="correction-type/[type]" options={offTabs} />
      {/* A Curated Collection's screen, from its card on the Dashboard; no tab leads to it. */}
      <Tabs.Screen name="curated-collection/[collectionId]" options={offTabs} />
      {/*
        The Categories (k1, k2) and a Category's screen (k3), from the Dashboard; no tab
        leads to them. A route left out here would be a hidden tab that sends its focus
        back to the Dashboard (Expo Router 58), so its tile would open nothing.
      */}
      <Tabs.Screen name="categories" options={offTabs} />
      <Tabs.Screen name="category/[categoryId]" options={offTabs} />
      {/* A Category's Feed, from a Word of its screen (ADR 0110); no tab leads to it. */}
      <Tabs.Screen name="category-feed/[categoryId]" options={offTabs} />
      <Tabs.Screen name="correction-categories" options={offTabs} />
      <Tabs.Screen name="correction-category/[categoryId]" options={offTabs} />
      {/* Search, from the magnifier of the «Стрічка» header; no tab leads to it. */}
      <Tabs.Screen name="search" options={offTabs} />
    </Tabs>
  );
}
