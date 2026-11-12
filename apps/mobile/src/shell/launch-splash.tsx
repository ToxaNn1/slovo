import { SplashOverlay } from '@slovo/ui';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';

import { editionStrings } from '../edition/edition';

// The native splash stays until the app's own splash is drawn over it.
void SplashScreen.preventAutoHideAsync();

/**
 * The design's splash cut over the native splash (ADR 0070): the whole cut on
 * every launch, then the app.
 */
export function LaunchSplash() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <SplashOverlay
      wordmark={editionStrings.splash.wordmark}
      tagline={editionStrings.splash.tagline}
      onShown={() => {
        void SplashScreen.hideAsync();
      }}
      onDone={() => {
        setDone(true);
      }}
    />
  );
}
