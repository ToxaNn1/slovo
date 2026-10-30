import { useRouter, useSegments } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { onDeviceNotificationTap } from '../notifications/device-notifications';

/**
 * Opens the Word of each notification the reader taps on the Entry screen,
 * through the link that marks it as from a notification. Over the Entry
 * stack of links (`/entry`), whatever is on it (the Entry of a notification,
 * the widget or the Feed, or a Correction opened over one), the new Entry
 * takes the place of the whole stack, so one «Назад» returns to where the
 * reader was before it, the Feed; over any other screen it opens on top.
 * Draws nothing.
 */
export function NotificationTaps({
  onTap = onDeviceNotificationTap,
}: {
  /** Calls `open` with the link of each tapped notification; returns the call that stops it. */
  onTap?: (open: (link: string) => void) => () => void;
}) {
  const router = useRouter();
  const [stack] = useSegments();
  const open = useEffectEvent((link: string) => {
    if (stack !== 'entry') {
      router.push(link);
      return;
    }
    // The screens over the stack's first go first: popping a stack of one is an action no navigator takes.
    if (router.canDismiss()) router.dismissAll();
    router.replace(link);
  });
  useEffect(() => onTap(open), [onTap]);
  return null;
}
