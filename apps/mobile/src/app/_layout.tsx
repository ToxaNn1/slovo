import { DecorProvider, FontSizeProvider, TokensProvider, typeSize } from '@slovo/ui';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { editionDecor, editionStrings, editionTokens } from '../edition';
import { LanguagePackProvider } from '../language-pack';
import { LaunchSplash } from '../launch-splash';
import { SettingsProvider, useColorSchemeInEffect, useSettings } from '../settings';

const { tabs } = editionStrings;

export default function RootLayout() {
  return (
    <SettingsProvider>
      <DecorProvider decor={editionDecor}>
        <ThemedTabs />
      </DecorProvider>
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
              <Tabs.Screen
                name="index"
                options={{ title: tabs.home, tabBarButtonTestID: 'tab-home' }}
              />
              <Tabs.Screen
                name="settings"
                options={{ title: tabs.settings, tabBarButtonTestID: 'tab-settings' }}
              />
              <Tabs.Screen
                name="game"
                options={{ title: tabs.game, tabBarButtonTestID: 'tab-game' }}
              />
              <Tabs.Screen
                name="saved"
                options={{ title: tabs.saved, tabBarButtonTestID: 'tab-saved' }}
              />
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
