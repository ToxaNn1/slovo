import { renderHook } from '@testing-library/react-native';
import { Slot, type NativeIntent } from 'expo-router';
import {
  Fragment,
  isValidElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type EdgeInsets } from 'react-native-safe-area-context';

import { coreDecor, createSettings, type Decor, type UserSettings } from '@slovo/core';

import { edition } from '../edition/edition';
import { Opened } from '../opened';
import type { Shell } from '../shell-value';
import { AppProviders, ScreenProviders } from '../app-providers';
import { renderInGestureRoot, renderRoutes } from './test-render';
import { opened, testShell } from './test-support';

// The one entry of the app's screen and route tests: a screen or a route map
// drawn as the device draws it. No screen or module of the app imports it.
// `expo-router/testing-library` puts Reanimated's mock in every module loaded
// after it: a test that animates as the device does imports this entry first.

/** The frame of an iPhone 15, which the router gives the screens on the device. */
const frame = { x: 0, y: 0, width: 390, height: 844 };

/** No safe-area insets: the screens run edge to edge. */
const noInsets: EdgeInsets = { top: 0, left: 0, right: 0, bottom: 0 };

/** A route map as Expo Router's test renderer takes it: a screen or a layout per route. */
type Routes = Readonly<Record<string, ComponentType>>;

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
  /** The route map's `+native-intent`: how the app takes a link from outside it. */
  readonly nativeIntent?: NativeIntent;
  /** The device's safe-area insets, such as a home indicator's; none by default. */
  readonly insets?: EdgeInsets;
}

/** The app's providers and screen gates around `children`, the very tree of `app/_layout.tsx`. */
function InApp({
  shell,
  decor,
  insets,
  children,
}: {
  shell: Shell;
  decor: Decor;
  insets: EdgeInsets;
  children: ReactNode;
}) {
  return (
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <AppProviders shell={shell} decor={decor}>
        {/* As `ForceUpdateGate` on the device, the screens wait for the remote switches; no test is below the minimum. */}
        <Opened opening={shell.remoteSwitches} failedTestID="language-pack-failed">
          <ScreenProviders>{children}</ScreenProviders>
        </Opened>
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
export function renderApp(
  screen: ReactElement,
  options?: InApp,
): ReturnType<typeof renderInGestureRoot>;
export function renderApp(routes: Routes, options?: InApp): ReturnType<typeof renderRoutes>;
export async function renderApp(
  screen: ReactElement | Routes,
  {
    shell = testShell(),
    settings,
    decor = coreDecor,
    initialUrl = '/',
    insets = noInsets,
    nativeIntent,
  }: InApp = {},
) {
  const drawn = settings === undefined ? shell : await withSettings(shell, settings);
  if (isValidElement(screen)) {
    // The tree is the renderer's wrapper, so a `rerender` of the screen keeps it.
    return renderInGestureRoot(screen, {
      wrapper: ({ children }) => (
        <GestureHandlerRootView>
          <InApp shell={drawn} decor={decor} insets={insets}>
            {children}
          </InApp>
        </GestureHandlerRootView>
      ),
    });
  }
  // A route map's own root layout, a navigator, draws inside the app's tree; a `Slot` by default.
  const { _layout: Layout = Slot, ...routes } = screen;
  return renderRoutes(
    {
      _layout: () => (
        <InApp shell={drawn} decor={decor} insets={insets}>
          <Layout />
        </InApp>
      ),
      ...routes,
      ...(nativeIntent === undefined ? {} : { '+native-intent': nativeIntent }),
    },
    { initialUrl },
  );
}

/**
 * Renders `hook` as a screen of the app calls it: inside the app's tree, under
 * the same Shell, settings, Edition, Decor and screen gates as `renderApp`.
 */
export async function renderHookInApp<T>(
  hook: () => T,
  {
    shell = testShell(),
    settings,
    decor = coreDecor,
    insets = noInsets,
    Screen = Fragment,
  }: InApp & {
    /** What the hook's own screen draws around it, such as its undo toast; nothing by default. */
    readonly Screen?: ComponentType<{ children: ReactNode }>;
  } = {},
) {
  const drawn = settings === undefined ? shell : await withSettings(shell, settings);
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <InApp shell={drawn} decor={decor} insets={insets}>
        <Screen>{children}</Screen>
      </InApp>
    ),
  });
}

/** `shell` with its settings at the Edition's defaults and `changes`, over the Shell's own user state. */
async function withSettings(shell: Shell, changes: Partial<UserSettings>): Promise<Shell> {
  const settings = createSettings({
    userState: await shell.userState.opened(),
    defaults: edition.userSettingDefaults,
  });
  return { ...shell, settings: opened({ settings, current: await settings.update(changes) }) };
}
