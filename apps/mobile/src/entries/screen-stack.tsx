import { Stack } from 'expo-router';

import { screenSettled } from './use-open-screen';

/**
 * The stack of a tab or a link: no header, and it tells the screen opener when
 * a screen has settled, so taps are held for exactly as long as it takes to open.
 */
export function ScreenStack() {
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      screenListeners={{ transitionEnd: screenSettled }}
    />
  );
}
