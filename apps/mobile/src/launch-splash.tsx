import { SplashOverlay } from '@slovo/ui';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';

import { editionStrings, splashImageWidth } from './edition/edition';

// The native splash stays until the app's own splash is drawn over it.
void SplashScreen.preventAutoHideAsync();

/** How long the splash stays once the wordmark and tagline are in. */
const HOLD_MS = 1000;
/** The mark's width when the native splash has no image to line it up with. */
const DEFAULT_MARK_WIDTH = 72;

/**
 * Decor slot 7: takes over from the native splash with the Edition's full
 * splash in the Theme in effect, then fades out to the app.
 */
export function LaunchSplash() {
  const [visible, setVisible] = useState(true);
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <SplashOverlay
      wordmark={editionStrings.splash.wordmark}
      tagline={editionStrings.splash.tagline}
      markWidth={splashImageWidth ?? DEFAULT_MARK_WIDTH}
      visible={visible}
      onShown={() => {
        void SplashScreen.hideAsync();
        setTimeout(() => {
          setVisible(false);
        }, HOLD_MS);
      }}
      onHidden={() => {
        setDone(true);
      }}
    />
  );
}
