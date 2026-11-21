import { fill, ScreenEnter, TabBarButton, type IconName } from '@slovo/ui';
import { tabBar } from '@slovo/ui/tokens';
import { router, Tabs, useIsFocused, usePathname } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import {
  Activity,
  createContext,
  use,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useGameState } from '@/game/game';
import type { Tab } from '@/shown';
import { useShown } from '@/shown-in-effect';
import { useEditionInEffect } from '@/edition/remote-switches';

const { tabs } = editionStrings;

/** Each tab's icon of the design's set. */
const tabIcons = {
  home: 'feed',
  game: 'games',
  mix: 'mix',
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

/** A tab button's own props, as `TabBarButton` takes them. */
type ButtonProps = ComponentProps<typeof TabBarButton>;

/** The «Стрічка» button, shown as selected over the Feed it opens too. */
function FeedTabButton(props: ButtonProps) {
  // Read here, not in the navigator, so a route change re-renders this button alone.
  const onFeed = usePathname() === '/feed';
  return <TabBarButton {...props} selected={props.selected || onFeed} />;
}

/**
 * A tab's `name`, test id and button among the tabs shown in their order. Its
 * VoiceOver label counts the tabs shown only, not the hidden routes beside
 * them, in the Edition's language. A tab not shown has no button. A button
 * shows as selected while its tab is focused; `Button` draws it.
 */
function tabOptions(
  tab: Tab,
  tabOrder: readonly Tab[],
  name: string,
  Button: (props: ButtonProps) => ReactNode = TabBarButton,
) {
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
      <Button
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

/**
 * Each tab's options but the bar's, built once for the tabs shown and their
 * names, so their buttons keep their identity across the navigator's renders.
 */
function tabsOptions(tabOrder: readonly Tab[], settingsName: string, feedTab: boolean) {
  return {
    // With `feedTab` on, «Стрічка» shows as selected over the Feed it opens.
    home: tabOptions('home', tabOrder, tabs.home, feedTab ? FeedTabButton : TabBarButton),
    game: tabOptions('game', tabOrder, tabs.game),
    // «Мікс» in the centre opens «Мій Мікс» as its root (ADR 0201).
    mix: tabOptions('mix', tabOrder, tabs.mix),
    saved: tabOptions('saved', tabOrder, tabs.saved),
    // The last tab is the Profile while it is shown, Settings otherwise.
    settings: tabOptions('settings', tabOrder, settingsName),
  } as const satisfies Record<Tab, unknown>;
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

/** The tab bar over the screens rather than under them: the screens keep their height when it hides. */
function overScreens(style: TabOptions['tabBarStyle'], barHeight: number) {
  return [
    style,
    { position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: barHeight },
    { paddingBottom: barHeight - tabBar.height },
  ];
}

/** The tab bar as the screen options draw it, and hidden. */
function barStates(style: TabOptions['tabBarStyle']) {
  return {
    shown: { tabBarStyle: style },
    hidden: { tabBarStyle: [style, { display: 'none' as const }] },
  };
}

/** The tab bar's height: the tabs, and the room under them over the home indicator. */
function useTabBarHeight(): number {
  const { bottom } = useSafeAreaInsets();
  return tabBar.height + Math.max(0, bottom - tabBar.homeIndicatorOverlap);
}

const TabBarRoom = createContext(0);

/**
 * The room the first screen of a tab's stack keeps for the tab bar over it, 0
 * where the bar never shows. The bar lies over the screens, so hiding it over
 * a pushed screen never resizes the stack in the middle of the push (owner, 16.11).
 */
export function useTabBarRoom(): number {
  return use(TabBarRoom);
}

/**
 * Whether a screen out of focus goes into hiding: a frame after it lost focus,
 * so it learns it is out of sight (and stops what runs only in sight) first.
 * It comes out in the same render that gives it focus back.
 */
function useHiddenOutOfFocus(focused: boolean): boolean {
  const [settledOut, setSettledOut] = useState(false);
  if (focused && settledOut) setSettledOut(false);
  useEffect(() => {
    if (focused) return;
    const frame = requestAnimationFrame(() => {
      setSettledOut(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [focused]);
  return !focused && settledOut;
}

/**
 * A screen of the tabs, entering as the design has it each time it gains
 * focus. Its focus is read from the navigation state on each render, so no
 * focus is missed between the first render and a subscription. Out of focus it
 * waits in a hidden Activity (memory pass, 19.11): it keeps its state, but drops
 * its subscriptions, so a Seen in the Feed, which changes the History, XP and
 * Badges, no longer re-renders the Saved and the Profile behind it. Back in
 * focus it subscribes again and draws what changed once.
 */
function FocusedEnter({ route, children }: Pick<ScreenLayoutProps, 'route' | 'children'>) {
  const focused = useIsFocused();
  const hidden = useHiddenOutOfFocus(focused);
  return (
    <ScreenEnter focused={focused} testID={`${route.name}-enter`}>
      <Activity mode={hidden ? 'hidden' : 'visible'}>{children}</Activity>
    </ScreenEnter>
  );
}

/**
 * The tabs the Edition shows in effect, in their final order: the Game's goes
 * and comes back with its Feature Switch, also one turned off remotely while
 * the app runs. As the boards, the tab bar shows only on a tab's
 * first screen and hides over everything a tab or a link pushes: an Entry,
 * Search, the Daily Crossword, a Game's Round and its result.
 */
export function EditionTabs({ screenOptions }: { screenOptions: TabOptions }) {
  const shown = useShown();
  const inEffect = useEditionInEffect();
  const options = tabsOptions(
    shown.tabs,
    inEffect.isFeatureEnabled('profile') ? tabs.profile : tabs.settings,
    inEffect.isFeatureEnabled('feedTab'),
  );
  /** While a Game is on, its Round or its result fills the Game tab. */
  const gameOn = useGameState().current !== undefined;
  const barHeight = useTabBarHeight();
  const tabBarStyle = overScreens(screenOptions.tabBarStyle, barHeight);
  const bar = barStates(tabBarStyle);
  const barOn = (onRoot: boolean) => (onRoot ? bar.shown : bar.hidden);
  const offTabs = { ...noTabButton, ...bar.hidden };
  /** A screen of the tabs the bar always shows over keeps clear of it. */
  const underBar = { sceneStyle: { paddingBottom: barHeight } };
  /** The tabs whose stack's first screen the bar shows over. */
  const roomOf = (name: string) =>
    name === 'mix' || name === 'saved' || name === 'settings' || (name === 'game' && !gameOn)
      ? barHeight
      : 0;
  return (
    <Tabs
      screenOptions={{ ...screenOptions, tabBarStyle }}
      // The way back leads to the screen opened before, as a Word of a Category leads back to
      // its Category; by default the tabs lead every screen no tab leads to back to the Dashboard.
      backBehavior="history"
      screenLayout={({ route, children }) => (
        <FocusedEnter route={route}>
          <TabBarRoom value={roomOf(route.name)}>{children}</TabBarRoom>
        </FocusedEnter>
      )}
    >
      <Tabs.Screen
        name="index"
        options={{ ...options.home, ...bar.shown, ...underBar }}
        listeners={{
          tabPress: (event) => {
            // The Dashboard stays the home at launch; its tab opens the Feed.
            if (!inEffect.isFeatureEnabled('feedTab')) return;
            event.preventDefault();
            router.navigate('/feed');
          },
        }}
      />
      <Tabs.Screen
        name="game"
        options={({ route }) => ({ ...options.game, ...barOn(atRoot(route) && !gameOn) })}
      />
      <Tabs.Screen
        name="mix"
        options={({ route }) => ({ ...options.mix, ...barOn(atRoot(route)) })}
      />
      <Tabs.Screen
        name="saved"
        options={({ route }) => ({ ...options.saved, ...barOn(atRoot(route)) })}
      />
      <Tabs.Screen
        name="settings"
        options={({ route }) => ({
          ...options.settings,
          ...barOn(atRoot(route, inEffect.isFeatureEnabled('profile') ? 'profile' : 'index')),
        })}
        listeners={{
          tabPress: (event) => {
            // The stack is built on the Profile (`settings/_layout`'s anchor). While the Profile
            // is off the tab is Settings, which opens over it.
            if (inEffect.isFeatureEnabled('profile')) return;
            event.preventDefault();
            router.navigate('/settings');
          },
        }}
      />
      {/* An Entry opened from a link, such as a notification's; no tab leads to it. */}
      <Tabs.Screen name="entry" options={offTabs} />
      {/* The recipient sheet of a Collection Link opened from outside; no tab leads to it. */}
      <Tabs.Screen name="c/[linkId]" options={offTabs} />
      {/* The Feed, from the Dashboard. */}
      <Tabs.Screen name="feed" options={{ ...noTabButton, ...bar.shown, ...underBar }} />
      {/* A Correction Type's screen, from its tile on the Dashboard; no tab leads to it. */}
      <Tabs.Screen name="correction-type/[type]" options={offTabs} />
      {/* A Curated Collection's screen, from its card on the Dashboard; no tab leads to it. */}
      <Tabs.Screen name="curated-collection/[collectionId]" options={offTabs} />
      {/* All Curated Collections, from «SLOVO пропонує»; no tab leads to them. */}
      <Tabs.Screen name="curated-collections" options={offTabs} />
      {/* A Curated Collection's Feed, from a Word of its screen; no tab leads to it. */}
      <Tabs.Screen name="curated-collection-feed/[collectionId]" options={offTabs} />
      {/*
        The Categories (k1, k2) and a Category's screen (k3), from the Dashboard; no tab
        leads to them. A route left out here would be a hidden tab that sends its focus
        back to the Dashboard (Expo Router 58), so its tile would open nothing.
      */}
      <Tabs.Screen name="categories" options={offTabs} />
      <Tabs.Screen name="category/[categoryId]" options={offTabs} />
      {/* A Category's Feed, from a Word of its screen; no tab leads to it. */}
      <Tabs.Screen name="category-feed/[categoryId]" options={offTabs} />
      <Tabs.Screen name="correction-categories" options={offTabs} />
      <Tabs.Screen name="correction-category/[categoryId]" options={offTabs} />
      {/* Search, from the magnifier of the «Стрічка» header; no tab leads to it. */}
      <Tabs.Screen name="search" options={offTabs} />
    </Tabs>
  );
}
