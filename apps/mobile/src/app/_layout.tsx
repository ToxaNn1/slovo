// Before anything that counts in the Edition's language.
import '@/shell/intl-polyfill';
import { MascotCelebrations } from '@/mascot/mascot';

import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { editionDecor, editionTokens } from '@/edition/edition';
import { ScreenViews } from '@/analytics/screen-views';
import { deviceClock } from '@/device/device-clock';
import { deviceFacts } from '@/device/device-facts';
import { ForceUpdateGate } from '@/force-update/force-update';
import { startCrashReports } from '@/diagnostics/crash-reports';
import { AppProviders, ScreenProviders } from '@/shell/app-providers';
import { DecorInEffect } from '@/shell/decor-in-effect';
import { InterfaceSoundsInEffect, soundEngine } from '@/sounds/interface-sounds';
import { appShell } from '@/shell/app-shell';
import { LaunchSplash } from '@/shell/launch-splash';
import { Lifecycle } from '@/shell/lifecycle';
import { useShell } from '@/shell-value';
import { NotificationTaps } from '@/entries/notification-taps';
import { Onboarding } from '@/onboarding/onboarding';
import { useColorSchemeInEffect } from '@/settings/settings';
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
      <AppProviders shell={appShell} decor={editionDecor}>
        <Tabs />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

/** The tabs in their final order: Home, Game (when it is on in effect), Saved, Settings. */
function Tabs() {
  const { composition } = useShell();
  const colorScheme = useColorSchemeInEffect();
  const colors = editionTokens.colors[colorScheme];

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {/* Outside the gates: each of its listeners waits for its own opening (ADR 0036, 0037). */}
      <Lifecycle />
      <ScreenViews />
      {/* Below the hard minimum no screen mounts: the force update waits for the remote switches alone (ADR 0089). */}
      <ForceUpdateGate device={deviceFacts}>
        <ScreenProviders>
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
        </ScreenProviders>
      </ForceUpdateGate>
      <LaunchSplash />
    </>
  );
}
