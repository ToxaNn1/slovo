import type { MixPlace } from '@slovo/contracts';
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

import { edition, editionStrings, editionTokens } from './edition/edition';
import { LemmaPronunciation } from './entries/pronunciation-button';
import { hapticEngine } from './game/haptics';
import { useWordIllustration } from './media/shell-media';
import { Opened } from './opened';
import { SettingsProvider, useColorSchemeInEffect, useSettings } from './settings/settings';
import { ShellProvider, useShell, type Shell } from './shell-value';
import { useEditionInEffect } from './edition/remote-switches';
import { mixPlaceOf } from './shown';

// The provider tree of the app, which `app/_layout.tsx` draws the tabs under
// and the screen tests draw a screen under (`shell/test-app.tsx`), so the two never drift.

/**
 * The providers of the whole app around `children`: the Shell, the settings,
 * the Edition, its Decor, the tokens, the navigation theme and the haptics in
 * effect. The screen tests draw under the same tree (`shell/test-app.tsx`), with a
 * `decor` of their own.
 */
export function AppProviders({
  shell,
  decor,
  children,
}: {
  shell: Shell;
  /** The Edition's Decor on the device. */
  decor: Decor;
  children: ReactNode;
}) {
  return (
    <ShellProvider shell={shell}>
      <SettingsProvider>
        <ShellEditionProvider>
          <DecorProvider decor={decor}>
            <ThemedProviders>{children}</ThemedProviders>
          </DecorProvider>
        </ShellEditionProvider>
      </SettingsProvider>
    </ShellProvider>
  );
}

/** The tokens, the navigation theme and the haptics in the colour scheme and Vibration the reader chose. */
/**
 * The Edition's strings and voice with the shell's Pronunciation and
 * Illustrations. Above the screens no text names where the Mix is, so
 * `mixPlace` is left to the screens' own provider.
 */
function ShellEditionProvider({
  mixPlace,
  children,
}: {
  mixPlace?: MixPlace;
  children: ReactNode;
}) {
  return (
    <EditionProvider
      edition={edition}
      strings={editionStrings}
      {...(mixPlace === undefined ? {} : { mixPlace })}
      pronunciation={LemmaPronunciation}
      useIllustration={useReaderIllustration}
    >
      {children}
    </EditionProvider>
  );
}

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
 * offline plate. The screen tests draw under the same gates (`shell/test-app.tsx`).
 */
export function ScreenProviders({ children }: { children: ReactNode }) {
  const { languagePack, composition } = useShell();
  return (
    // Every screen draws over the open Language Pack and composition.
    <Opened opening={languagePack} failedTestID="language-pack-failed">
      <Opened opening={composition} failedTestID="feed-error">
        {/* The screens' background and divider follow the local date. */}
        <TextSizeInEffect>
          <ReduceMotionInEffect>
            <EditionInEffect>
              <RouteInEffect>
                {/* «Немає з’єднання» over every screen, under the status bar. */}
                <OfflinePlateProvider message={editionStrings.offlinePlate}>
                  {children}
                </OfflinePlateProvider>
              </RouteInEffect>
            </EditionInEffect>
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
  const reduceMotionSetting = useEditionInEffect().isFeatureEnabled('reduceMotion');
  const { reduceMotion } = useSettings().current;
  return (
    <ReduceMotionProvider reduceMotion={reduceMotionSetting && reduceMotion}>
      {children}
    </ReduceMotionProvider>
  );
}

/** Gives the screens the texts that name where the Mix is in their version for the mixTab switch in effect (ADR 0201). */
function EditionInEffect({ children }: { children: ReactNode }) {
  return (
    <ShellEditionProvider mixPlace={mixPlaceOf(useEditionInEffect())}>
      {children}
    </ShellEditionProvider>
  );
}

/** Gives the Word cards the reader's step on the three-step text size ladder. */
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
