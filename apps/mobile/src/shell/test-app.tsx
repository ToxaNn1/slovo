import { Slot } from 'expo-router';
import { isValidElement, type ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { coreDecor, createSettings, type Decor, type UserSettings } from '@slovo/core';

import { edition } from '../edition/edition';
import type { Shell } from '../shell-value';
import { AppProviders, ScreenProviders } from './app-providers';
import { renderInGestureRoot, renderRoutes } from './test-render';
import { opened, testShell } from './test-support';

// The one entry of the app's screen and route tests: a screen or a route map
// drawn as the device draws it. No screen or module of the app imports it.

/** The safe area of an iPhone 15 with no insets, which the router gives the screens on the device. */
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** A route map as Expo Router's test renderer takes it, without the root layout. */
type Routes = Exclude<Parameters<typeof renderRoutes>[0], string | string[]>;

export interface InApp {
  /**
   * The Shell the app draws under: the user state, the settings (the text
   * size and the colour scheme among them) and the Feature Switches in
   * effect. A test Shell over an empty Language Pack by default.
   */
  readonly shell?: Shell;
  /** The settings the reader changed, the text size among them, kept in the Shell's own user state. */
  readonly settings?: Partial<UserSettings>;
  /**
   * The Decor in effect: the Core's plain one by default, as the Edition's
   * Mascot moves without end and a test's `runAllTimers` would never settle.
   */
  readonly decor?: Decor;
  /** The route the router opens first, for a route map. `/` by default. */
  readonly initialUrl?: string;
}

/** The app's providers and screen gates around `children`, the very tree of `app/_layout.tsx`. */
function InApp({ shell, decor, children }: { shell: Shell; decor: Decor; children: ReactElement }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders shell={shell} decor={decor}>
        <ScreenProviders>{children}</ScreenProviders>
      </AppProviders>
    </SafeAreaProvider>
  );
}

/**
 * Draws a screen, or a route map under a root layout of the app's own tree, as
 * the device does: under the Shell, the settings, the Edition, the Decor, the
 * tokens, the haptics, the open composition, the text size, Reduce Motion, the
 * route on screen and the offline plate.
 */
export async function renderApp(
  screen: ReactElement | Routes,
  { shell = testShell(), settings, decor = coreDecor, initialUrl = '/' }: InApp = {},
) {
  const drawn = settings === undefined ? shell : await withSettings(shell, settings);
  if (isValidElement(screen)) {
    return renderInGestureRoot(
      <InApp shell={drawn} decor={decor}>
        {screen}
      </InApp>,
    );
  }
  return renderRoutes(
    {
      _layout: () => (
        <InApp shell={drawn} decor={decor}>
          <Slot />
        </InApp>
      ),
      ...screen,
    },
    { initialUrl },
  );
}

/** `shell` with its settings at the Edition's defaults and `changes`, over the Shell's own user state. */
async function withSettings(shell: Shell, changes: Partial<UserSettings>): Promise<Shell> {
  const settings = createSettings({
    userState: await shell.userState.opened(),
    defaults: edition.userSettingDefaults,
  });
  return { ...shell, settings: opened({ settings, current: await settings.update(changes) }) };
}
