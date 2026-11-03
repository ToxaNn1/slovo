import { Stack } from 'expo-router';

import { screenSettled } from './use-open-screen';

/**
 * The stack of a tab or a link: no header, and it tells the screen opener when
 * a screen has settled, so taps are held for exactly as long as it takes to open.
 * Its first screen is `initialRouteName` when given.
 */
export function ScreenStack({ initialRouteName }: { initialRouteName?: string }) {
  return (
    <Stack
      {...(initialRouteName === undefined ? {} : { initialRouteName })}
      screenOptions={{ headerShown: false }}
      screenListeners={{
        transitionEnd: ({ data }) => {
          // A screen closing is not the push the opener waits on.
          if (!data.closing) screenSettled();
        },
      }}
    />
  );
}
