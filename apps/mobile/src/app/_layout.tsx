// Before anything that counts in the Edition's language.
import '@/shell/intl-polyfill';
import { MascotCelebrations } from '@/mascot/mascot';

import { createHaptics } from '@slovo/core';
import {
  DecorProvider,
  EditionProvider,
  fill,
  FontSizeProvider,
  HapticsProvider,
  ReduceMotionProvider,
  ScreenEnter,
  TabBarButton,
  TokensProvider,
  type IconName,
} from '@slovo/ui';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  edition,
  editionDecor,
  editionIllustrations,
  editionStrings,
  editionTokens,
} from '@/edition/edition';
import { ScreenViews } from '@/analytics/screen-views';
import { hapticEngine } from '@/game/haptics';
import { deviceClock } from '@/device/device-clock';
import { startCrashReports } from '@/diagnostics/crash-reports';
import { DecorInEffect } from '@/shell/decor-in-effect';
import { appShell } from '@/shell/app-shell';
import { LaunchSplash } from '@/shell/launch-splash';
import { Lifecycle } from '@/shell/lifecycle';
import { ShellProvider, useShell } from '@/shell-value';
import { NotificationTaps } from '@/entries/notification-taps';
import { Onboarding } from '@/onboarding/onboarding';
import { Opened } from '@/opened';
import { LemmaPronunciation } from '@/entries/pronunciation-button';
import { SettingsProvider, useColorSchemeInEffect, useSettings } from '@/settings/settings';
import type { Tab } from '@/shown';
import { useShown } from '@/shown-in-effect';

// Before the first screen, so a crash at launch is reported too.
startCrashReports(process.env.EXPO_PUBLIC_SENTRY_DSN);

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
 * A tab's name, test id and button among the tabs shown in their order. Its
 * VoiceOver label counts the tabs shown only, not the hidden routes beside
 * them, in the Edition's language. A tab not shown has no button.
 */
function tabOptions(tab: Tab, tabOrder: readonly Tab[]) {
  if (!tabOrder.includes(tab)) return { href: null };
  return {
    title: tabs[tab],
    tabBarButtonTestID: `tab-${tab}`,
    tabBarAccessibilityLabel: fill(tabs.accessibilityLabel, {
      tab: tabs[tab],
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
        label={tabs[tab]}
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

/** A screen of the tabs, entering as the design has it each time it gains focus. */
function FocusedEnter({
  navigation,
  children,
}: Pick<ScreenLayoutProps, 'navigation' | 'children'>) {
  const [focused, setFocused] = useState(() => navigation.isFocused());
  useEffect(() => {
    const offFocus = navigation.addListener('focus', () => {
      setFocused(true);
    });
    const offBlur = navigation.addListener('blur', () => {
      setFocused(false);
    });
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return <ScreenEnter focused={focused}>{children}</ScreenEnter>;
}

export default function RootLayout() {
  return (
    // The one gesture root of the app: swipe rows, sheets and the pager rely on it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Every opening of the app run, for every screen (ADR 0036). */}
      <ShellProvider shell={appShell}>
        <SettingsProvider>
          <EditionProvider
            edition={edition}
            strings={editionStrings}
            pronunciation={LemmaPronunciation}
            illustrations={editionIllustrations}
          >
            <DecorProvider decor={editionDecor}>
              <ThemedTabs />
            </DecorProvider>
          </EditionProvider>
        </SettingsProvider>
      </ShellProvider>
    </GestureHandlerRootView>
  );
}

/** The tabs in their final order: Home, Game (when it is on in effect), Saved, Settings. */
function ThemedTabs() {
  const { languagePack, composition } = useShell();
  const colorScheme = useColorSchemeInEffect();
  const { fontSize, vibration } = useSettings().current;
  const haptics = useMemo(
    () => createHaptics({ engine: hapticEngine, vibration: () => vibration }),
    [vibration],
  );
  const colors = editionTokens.colors[colorScheme];

  // Screen backgrounds and the tab bar follow the tokens too.
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.background,
        text: colors.ink,
        border: colors.line,
        notification: colors.accent,
      },
    };
  }, [colorScheme, colors]);

  return (
    <TokensProvider tokens={editionTokens} colorScheme={colorScheme}>
      <ThemeProvider value={navigationTheme}>
        <FontSizeProvider fontSize={fontSize}>
          <HapticsProvider haptics={haptics}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            {/* Outside the gates: each of its listeners waits for its own opening (ADR 0036, 0037). */}
            <Lifecycle />
            <ScreenViews />
            {/* Every screen draws over the open Language Pack and composition. */}
            <Opened opening={languagePack} failedTestID="language-pack-failed">
              <Opened opening={composition} failedTestID="feed-error">
                {/* The screens' background and divider follow the local date (ADR 0055). */}
                <ReduceMotionInEffect>
                  <DecorInEffect clock={deviceClock}>
                    <NotificationTaps
                      onOpened={(kind) => {
                        // The event never fails; a composition that fails to open is reported where it opens.
                        composition.opened().then(
                          (open) => open.analytics.notificationOpened(kind),
                          () => undefined,
                        );
                      }}
                    />
                    <EditionTabs
                      screenOptions={{
                        headerShown: false,
                        tabBarStyle: {
                          backgroundColor: colors.tabBar,
                          borderTopColor: colors.line,
                        },
                      }}
                    />
                    {/* Over the tabs until the reader finishes or skips it. */}
                    <MascotCelebrations />
                    <Onboarding />
                  </DecorInEffect>
                </ReduceMotionInEffect>
              </Opened>
            </Opened>
          </HapticsProvider>
        </FontSizeProvider>
        <LaunchSplash />
      </ThemeProvider>
    </TokensProvider>
  );
}

/**
 * Gives the screens the reader's «Менше руху» while its Feature Switch is in
 * effect; the system's Reduce Motion counts either way.
 */
function ReduceMotionInEffect({ children }: { children: ReactNode }) {
  const { reduceMotionSetting } = useShown();
  const { reduceMotion } = useSettings().current;
  return (
    <ReduceMotionProvider reduceMotion={reduceMotionSetting && reduceMotion}>
      {children}
    </ReduceMotionProvider>
  );
}

/**
 * The tabs the Edition shows in effect, in their final order: the Game's goes
 * and comes back with its Feature Switch, also one turned off remotely while
 * the app runs (ADR 0040).
 */
function EditionTabs({ screenOptions }: { screenOptions: TabOptions }) {
  const tabOrder = useShown().tabs;
  return (
    <Tabs
      screenOptions={screenOptions}
      screenLayout={({ navigation, children }) => (
        <FocusedEnter navigation={navigation}>{children}</FocusedEnter>
      )}
    >
      <Tabs.Screen name="index" options={tabOptions('home', tabOrder)} />
      <Tabs.Screen name="game" options={tabOptions('game', tabOrder)} />
      <Tabs.Screen name="saved" options={tabOptions('saved', tabOrder)} />
      <Tabs.Screen name="settings" options={tabOptions('settings', tabOrder)} />
      {/* An Entry opened from a link, such as a notification's; no tab leads to it. */}
      <Tabs.Screen name="entry" options={{ href: null }} />
      {/* The recipient sheet of a Collection Link opened from outside; no tab leads to it. */}
      <Tabs.Screen name="c/[linkId]" options={{ href: null }} />
      {/* Search, from the magnifier of the «Головна» header; no tab leads to it. */}
      <Tabs.Screen name="search" options={{ href: null }} />
      {/* The Word the mood roulette of the «Головна» header lands on; no tab leads to it. */}
      <Tabs.Screen name="mood" options={{ href: null }} />
      {/* The dev-only Decor showcase; no tab leads to it. */}
      <Tabs.Screen name="decor" options={{ href: null }} />
    </Tabs>
  );
}
