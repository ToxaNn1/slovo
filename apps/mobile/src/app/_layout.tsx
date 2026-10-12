import {
  DecorProvider,
  EditionProvider,
  fill,
  FontSizeProvider,
  TokensProvider,
  typeSize,
} from '@slovo/ui';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { edition, editionDecor, editionStrings, editionTokens } from '../edition';
import { LanguagePackProvider } from '../language-pack';
import { LaunchSplash } from '../launch-splash';
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
  const { fontSize } = useSettings().current;
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
          <LanguagePackProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarIcon: () => null,
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
              {/* The dev-only Decor showcase; no tab leads to it. */}
              <Tabs.Screen name="decor" options={{ href: null }} />
            </Tabs>
          </LanguagePackProvider>
        </FontSizeProvider>
        <LaunchSplash />
      </ThemeProvider>
    </TokensProvider>
  );
}
