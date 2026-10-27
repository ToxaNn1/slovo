import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { openedFromOf } from './entry-link';
import { onDeviceNotificationTap } from '../notifications/device-notifications';

/** What the opener reads of a navigator's state: its screens, the one on top, and theirs. */
interface ScreensState {
  readonly index?: number | undefined;
  readonly routes: readonly {
    readonly params?: object | undefined;
    readonly state?: ScreensState | undefined;
  }[];
}

/**
 * The params of the screen on top. They are read from the navigation state:
 * Expo Router's global search params also carry the params a stack was first
 * opened with, so a Correction pushed over a notification's Entry would read
 * as from a notification too.
 */
function topScreenParams(state: ScreensState): { readonly from?: string } {
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (route?.state !== undefined) return topScreenParams(route.state);
  return route?.params ?? {};
}

/**
 * Opens the Word of each notification the reader taps on the Entry screen,
 * through the link that marks it as from a notification. Over an Entry a link
 * opened, a notification's or the widget's, the new Entry replaces it, so
 * «Назад» still returns to where the reader was before the first; over any
 * other screen, such as the Feed or a Correction opened inside the Entry
 * stack, it opens on top. Draws nothing.
 */
export function NotificationTaps({
  onTap = onDeviceNotificationTap,
}: {
  /** Calls `open` with the link of each tapped notification; returns the call that stops it. */
  onTap?: (open: (link: string) => void) => () => void;
}) {
  const router = useRouter();
  const [stack] = useSegments();
  const navigationState = useRootNavigationState();
  const open = useEffectEvent((link: string) => {
    const entryFromLinkOnTop =
      stack === 'entry' && openedFromOf(topScreenParams(navigationState)) !== undefined;
    if (entryFromLinkOnTop) router.replace(link);
    else router.push(link);
  });
  useEffect(() => onTap(open), [onTap]);
  return null;
}
