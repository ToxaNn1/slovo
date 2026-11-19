import { createHaptics, type Decor } from '@slovo/core';
import {
  DecorProvider,
  EditionProvider,
  FontSizeProvider,
  HapticsProvider,
  OfflinePlateProvider,
  ReduceMotionProvider,
  RouteProvider,
  TokensProvider,
} from '@slovo/ui';
import { DarkTheme, DefaultTheme, ThemeProvider, usePathname } from 'expo-router';
import { useMemo, type ReactNode } from 'react';

import { edition, editionStrings, editionTokens } from '../edition/edition';
import { LemmaPronunciation } from '../entries/pronunciation-button';
import { hapticEngine } from '../game/haptics';
import { useWordIllustration } from '../media/shell-media';
import { Opened } from '../opened';
import { SettingsProvider, useColorSchemeInEffect, useSettings } from '../settings/settings';
import { ShellProvider, useShell, type Shell } from '../shell-value';
import { useShown } from '../shown-in-effect';

// The provider tree of the app, which `app/_layout.tsx` draws the tabs under
// and the screen tests draw a screen under (`test-app.tsx`), so the two never drift.

/**
 * The providers of the whole app around `children`: the Shell, the settings,
 * the Edition, its Decor, the tokens, the navigation theme and the haptics in
 * effect. The screen tests draw under the same tree (`test-app.tsx`), with a
 * `decor` of their own.
 */
export function AppProviders({
  shell,
  decor,
  children,
}: {
  shell: Shell;
  /** The Edition's Decor on the device (ADR 0055). */
  decor: Decor;
  children: ReactNode;
}) {
  return (
    <ShellProvider shell={shell}>
      <SettingsProvider>
        <EditionProvider
          edition={edition}
          strings={editionStrings}
          pronunciation={LemmaPronunciation}
          useIllustration={useReaderIllustration}
        >
          <DecorProvider decor={decor}>
            <ThemedProviders>{children}</ThemedProviders>
          </DecorProvider>
        </EditionProvider>
      </SettingsProvider>
    </ShellProvider>
  );
}

/** The tokens, the navigation theme and the haptics in the colour scheme and Vibration the reader chose. */
function ThemedProviders({ children }: { children: ReactNode }) {
  const colorScheme = useColorSchemeInEffect();
  const { vibration } = useSettings().current;
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
        <HapticsProvider haptics={haptics}>{children}</HapticsProvider>
      </ThemeProvider>
    </TokensProvider>
  );
}

/**
 * What every screen draws under inside `AppProviders`: the open Language Pack
 * and composition, the text size, Reduce Motion, the route on screen and the
 * offline plate. The screen tests draw under the same gates (`test-app.tsx`).
 */
export function ScreenProviders({ children }: { children: ReactNode }) {
  const { languagePack, composition } = useShell();
  return (
    // Every screen draws over the open Language Pack and composition.
    <Opened opening={languagePack} failedTestID="language-pack-failed">
      <Opened opening={composition} failedTestID="feed-error">
        {/* The screens' background and divider follow the local date (ADR 0055). */}
        <TextSizeInEffect>
          <ReduceMotionInEffect>
            <RouteInEffect>
              {/* «Немає з’єднання» over every screen, under the status bar (ADR 0158). */}
              <OfflinePlateProvider message={editionStrings.offlinePlate}>
                {children}
              </OfflinePlateProvider>
            </RouteInEffect>
          </ReduceMotionInEffect>
        </TextSizeInEffect>
      </Opened>
    </Opened>
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

/** Gives the Word cards the reader's step on the three-step text size ladder (ADR 0134). */
function TextSizeInEffect({ children }: { children: ReactNode }) {
  const { textSize } = useSettings().current;
  return <FontSizeProvider size={textSize}>{children}</FontSizeProvider>;
}

/** The route on screen for every sheet below, so a sheet closes when another route comes on screen. */
function RouteInEffect({ children }: { children: ReactNode }) {
  return <RouteProvider route={usePathname()}>{children}</RouteProvider>;
}

/** A Word's Illustration in the Narrator Voice the reader chose. */
function useReaderIllustration(wordId: string) {
  return useWordIllustration(wordId, useSettings().current.narratorVoice);
}
