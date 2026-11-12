// Before anything that counts in the Edition's language.
import '@/shell/intl-polyfill';
import { useWordIllustration } from '../media/shell-media';
import { MascotCelebrations } from '@/mascot/mascot';

import { createHaptics } from '@slovo/core';
import {
  DecorProvider,
  EditionProvider,
  FontSizeProvider,
  HapticsProvider,
  ReduceMotionProvider,
  RouteProvider,
  TokensProvider,
} from '@slovo/ui';
import { DarkTheme, DefaultTheme, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { edition, editionDecor, editionStrings, editionTokens } from '@/edition/edition';
import { ScreenViews } from '@/analytics/screen-views';
import { hapticEngine } from '@/game/haptics';
import { deviceClock } from '@/device/device-clock';
import { deviceFacts } from '@/device/device-facts';
import { ForceUpdateGate } from '@/force-update/force-update';
import { startCrashReports } from '@/diagnostics/crash-reports';
import { DecorInEffect } from '@/shell/decor-in-effect';
import { InterfaceSoundsInEffect, soundEngine } from '@/sounds/interface-sounds';
import { appShell } from '@/shell/app-shell';
import { LaunchSplash } from '@/shell/launch-splash';
import { Lifecycle } from '@/shell/lifecycle';
import { ShellProvider, useShell } from '@/shell-value';
import { NotificationTaps } from '@/entries/notification-taps';
import { Onboarding } from '@/onboarding/onboarding';
import { Opened } from '@/opened';
import { LemmaPronunciation } from '@/entries/pronunciation-button';
import { SettingsProvider, useColorSchemeInEffect, useSettings } from '@/settings/settings';
import { useShown } from '@/shown-in-effect';
import { EditionTabs } from '@/shell/edition-tabs';
import { useEditionFontsReady } from '@/shell/expo-go-fonts';

// Before the first screen, so a crash at launch is reported too.
startCrashReports(process.env.EXPO_PUBLIC_SENTRY_DSN);

export default function RootLayout() {
  // In Expo Go only: nothing draws until the Edition's fonts have loaded.
  if (!useEditionFontsReady()) return null;

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
            useIllustration={useReaderIllustration}
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
            {/* Below the hard minimum no screen mounts: the force update waits for the remote switches alone (ADR 0089). */}
            <ForceUpdateGate device={deviceFacts}>
              {/* Every screen draws over the open Language Pack and composition. */}
              <Opened opening={languagePack} failedTestID="language-pack-failed">
                <Opened opening={composition} failedTestID="feed-error">
                  {/* The screens' background and divider follow the local date (ADR 0055). */}
                  <ReduceMotionInEffect>
                    <RouteInEffect>
                      <InterfaceSoundsInEffect engine={soundEngine}>
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
                      </InterfaceSoundsInEffect>
                    </RouteInEffect>
                  </ReduceMotionInEffect>
                </Opened>
              </Opened>
            </ForceUpdateGate>
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

/** The route on screen for every sheet below, so a sheet closes when another route comes on screen. */
function RouteInEffect({ children }: { children: ReactNode }) {
  return <RouteProvider route={usePathname()}>{children}</RouteProvider>;
}

/** A Word's Illustration in the Narrator Voice the reader chose. */
function useReaderIllustration(wordId: string) {
  return useWordIllustration(wordId, useSettings().current.narratorVoice);
}
