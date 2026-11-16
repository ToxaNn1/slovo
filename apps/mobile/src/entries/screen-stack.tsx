import { Stack } from 'expo-router';

import { useTabBarRoom } from '../shell/edition-tabs';
import { screenSettled } from '../use-open-screen';

/**
 * The stack of a tab or a link: no header, and it tells the screen opener when
 * a screen has settled, so taps are held for exactly as long as it takes to open.
 * Its first screen is `initialRouteName` when given, `index` otherwise; under a
 * tab it keeps clear of the tab bar over it, and a screen pushed over it, which
 * the bar hides over, takes the whole height.
 */
export function ScreenStack({ initialRouteName }: { initialRouteName?: string }) {
  const room = useTabBarRoom();
  const first = initialRouteName ?? 'index';
  return (
    <Stack
      {...(initialRouteName === undefined ? {} : { initialRouteName })}
      screenOptions={({ route }) => ({
        headerShown: false,
        ...(route.name === first && room > 0 ? { contentStyle: { paddingBottom: room } } : {}),
      })}
      screenListeners={{
        transitionEnd: ({ data }) => {
          // A screen closing is not the push the opener waits on.
          if (!data.closing) screenSettled();
        },
      }}
    />
  );
}
