import type { NotificationsState, NotificationTimeRefusal } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useComposition } from '../composition';
import { onDeviceNotificationTap } from './device-notifications';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { notificationsSummary } from './notifications-summary';

/**
 * Opens the Word of each notification the reader taps on the Entry screen,
 * through the link that marks it as from a notification. Draws nothing.
 */
export function NotificationTaps() {
  const router = useRouter();
  useEffect(
    () =>
      onDeviceNotificationTap((link) => {
        router.push(link);
      }),
    [router],
  );
  return null;
}

/** The Notification times and the sound as they stand, kept up to date. */
export function useNotificationsState(): NotificationsState {
  return useSubscribed(useComposition().notifications, ({ state }) => state);
}

/** The value of the «Сповіщення» row of Settings. */
export function useNotificationsSummary(): string {
  const state = useNotificationsState();
  const { count } = useEdition();
  return useMemo(
    () =>
      notificationsSummary({ notifications: state, strings: editionStrings.notifications, count }),
    [state, count],
  );
}

/**
 * The calls that change the Notification times and the sound, and ask for
 * permission. A change that could not be kept is logged and leaves things as
 * they were.
 */
export function useNotificationsChanges(): {
  /**
   * Keeps the time the reader picked: it replaces the time `replacing`, or is
   * added without one. Resolves to why it was refused, or nothing when it is
   * kept or could not be written.
   */
  keepTime: (time: string, replacing?: string) => Promise<NotificationTimeRefusal | undefined>;
  removeTime: (time: string) => void;
  setSound: (on: boolean) => void;
  /** Asks the reader for permission to notify; a grant plans the notifications. */
  askPermission: () => void;
} {
  const { notifications } = useComposition();
  const subject = 'the notifications';
  return {
    keepTime: (time, replacing) =>
      keep(subject, notifications.keepTime(time, replacing), undefined),
    removeTime: (time) => {
      void keep(subject, notifications.removeTime(time), undefined);
    },
    setSound: (on) => {
      void keep(subject, notifications.setSound(on), undefined);
    },
    askPermission: () => {
      void keep(subject, notifications.askPermission(), undefined);
    },
  };
}
