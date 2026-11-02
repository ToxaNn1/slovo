import { launchKind, type LaunchKind } from '@slovo/core';
import { SplashOverlay } from '@slovo/ui';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { editionStrings } from '../edition/edition';
import { useShell } from '../shell-value';

// The native splash stays until the app's own splash is drawn over it.
void SplashScreen.preventAutoHideAsync();

/**
 * The design's splash cut over the native splash (ADR 0070): the whole cut on
 * the first launch, the fast replay on a daily open, then the app. The native
 * splash stays while the user state says which launch this is; one that fails
 * to open counts as a daily open, so the splash never holds the app back.
 */
export function LaunchSplash() {
  const { userState } = useShell();
  const [kind, setKind] = useState<LaunchKind>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    userState
      .opened()
      .then(launchKind)
      .catch((): LaunchKind => 'daily')
      .then((read) => {
        if (active) setKind(read);
      });
    return () => {
      active = false;
    };
  }, [userState]);
  if (done || kind === undefined) return null;
  return (
    <SplashOverlay
      wordmark={editionStrings.splash.wordmark}
      tagline={editionStrings.splash.tagline}
      kind={kind}
      onShown={() => {
        void SplashScreen.hideAsync();
      }}
      onDone={() => {
        setDone(true);
      }}
    />
  );
}
