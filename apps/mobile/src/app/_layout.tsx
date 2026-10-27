// Before anything that counts in the Edition's language.
import '@/shell/intl-polyfill';

import { createHaptics } from '@slovo/core';
import {
  DecorProvider,
  EditionProvider,
  fill,
  FontSizeProvider,
  HapticsProvider,
  TokensProvider,
  typeSize,
  useEdition,
} from '@slovo/ui';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, type ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { edition, editionDecor, editionStrings, editionTokens } from '@/edition/edition';
import { hapticEngine } from '@/game/haptics';
import { languagePackOpening } from '@/content-update/language-pack';
import { compositionOpening } from '@/composition';
import { startCrashReports } from '@/diagnostics/crash-reports';
import { LaunchSplash } from '@/shell/launch-splash';
import { Lifecycle } from '@/shell/lifecycle';
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

/**
 * A tab's name, test id and VoiceOver label, among the tabs shown in their
 * order. The label counts the tabs shown only, not the hidden routes beside
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
  };
}

type TabOptions = Exclude<
  ComponentProps<typeof Tabs>['screenOptions'],
  ((...args: never[]) => unknown) | undefined
>;
type TabButtonProps = Parameters<NonNullable<TabOptions['tabBarButton']>>[0];

/**
 * A tab's button, which VoiceOver reads in the Edition's language: the
 * navigator's own button has no way to set it. It is a plain Pressable with
 * what the navigator hands the button, as the effects of the navigator's
 * (hover, press colour) are off in this tab bar.
 */
function TabButton({
  onPress,
  onLongPress,
  testID,
  role,
  style,
  children,
  'aria-label': ariaLabel,
  'aria-selected': ariaSelected,
  accessibilityLargeContentTitle,
  accessibilityShowsLargeContentViewer,
}: TabButtonProps) {
  const { voice } = useEdition();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      role={role}
      style={style}
      aria-label={ariaLabel}
      aria-selected={ariaSelected}
      accessibilityLargeContentTitle={accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={accessibilityShowsLargeContentViewer}
      {...voice}
    >
      {children}
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    // The one gesture root of the app: swipe rows, sheets and the pager rely on it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <EditionProvider
          edition={edition}
          strings={editionStrings}
          pronunciation={LemmaPronunciation}
        >
          <DecorProvider decor={editionDecor}>
            <ThemedTabs />
          </DecorProvider>
        </EditionProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

/** The tabs in their final order: Home, Settings, Game (when it is on in effect), Saved. */
function ThemedTabs() {
  const colorScheme = useColorSchemeInEffect();
  const { fontSize, vibration } = useSettings().current;
  const haptics = useMemo(
    () => createHaptics({ engine: hapticEngine, vibration: () => vibration }),
    [vibration],
  );
  const colors = editionTokens.colors[colorScheme];
  const { ui } = editionTokens.fontFamilies;

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
            {/* Every screen draws over the open Language Pack and composition. */}
            <Opened opening={languagePackOpening} failedTestID="language-pack-failed">
              <Opened opening={compositionOpening} failedTestID="feed-error">
                <NotificationTaps />
                <EditionTabs
                  screenOptions={{
                    headerShown: false,
                    tabBarIcon: () => null,
                    tabBarButton: TabButton,
                    tabBarActiveTintColor: colors.accent,
                    tabBarInactiveTintColor: colors.inactiveTab,
                    tabBarLabelStyle: {
                      fontFamily: ui,
                      fontSize: typeSize.tabLabel,
                      fontWeight: '600',
                    },
                  }}
                />
                {/* Over the tabs until the reader finishes or skips it. */}
                <Onboarding />
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
 * The tabs the Edition shows in effect, in their final order: the Game's goes
 * and comes back with its Feature Switch, also one turned off remotely while
 * the app runs (ADR 0040).
 */
function EditionTabs({ screenOptions }: { screenOptions: TabOptions }) {
  const tabOrder = useShown().tabs;
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={tabOptions('home', tabOrder)} />
      <Tabs.Screen name="settings" options={tabOptions('settings', tabOrder)} />
      <Tabs.Screen name="game" options={tabOptions('game', tabOrder)} />
      <Tabs.Screen name="saved" options={tabOptions('saved', tabOrder)} />
      {/* An Entry opened from a link, such as a notification's; no tab leads to it. */}
      <Tabs.Screen name="entry" options={{ href: null }} />
      {/* The dev-only Decor showcase; no tab leads to it. */}
      <Tabs.Screen name="decor" options={{ href: null }} />
    </Tabs>
  );
}
