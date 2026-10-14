// Before anything that counts in the Edition's language.
import '../intl-polyfill';

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

import { edition, editionDecor, editionStrings, editionTokens } from '../edition';
import { hapticEngine } from '../haptics';
import { LanguagePackProvider } from '../language-pack';
import { LaunchSplash } from '../launch-splash';
import { Onboarding } from '../onboarding';
import { ActiveDays } from '../progress';
import { LemmaPronunciation } from '../pronunciation-button';
import { SettingsProvider, useColorSchemeInEffect, useSettings } from '../settings';

const { tabs } = editionStrings;

/** The tabs in their final order: Home, Settings, Game, Saved. */
const tabOrder = ['home', 'settings', 'game', 'saved'] as const;

/**
 * A tab's name, test id and VoiceOver label. The label counts the four tabs
 * only, not the hidden routes beside them, in the Edition's language.
 */
function tabOptions(tab: (typeof tabOrder)[number]) {
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
  );
}

/** The four tabs in their final order: Home, Settings, Game, Saved. */
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
            <LanguagePackProvider>
              <ActiveDays />
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <Tabs
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
              >
                <Tabs.Screen name="index" options={tabOptions('home')} />
                <Tabs.Screen name="settings" options={tabOptions('settings')} />
                <Tabs.Screen name="game" options={tabOptions('game')} />
                <Tabs.Screen name="saved" options={tabOptions('saved')} />
                {/* An Entry opened from a link, such as a notification's; no tab leads to it. */}
                <Tabs.Screen name="entry" options={{ href: null }} />
                {/* The dev-only Decor showcase; no tab leads to it. */}
                <Tabs.Screen name="decor" options={{ href: null }} />
              </Tabs>
              {/* Over the tabs until the reader finishes or skips it. */}
              <Onboarding />
            </LanguagePackProvider>
          </HapticsProvider>
        </FontSizeProvider>
        <LaunchSplash />
      </ThemeProvider>
    </TokensProvider>
  );
}
