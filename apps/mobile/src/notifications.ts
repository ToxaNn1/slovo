import type { NotificationsState, NotificationTimeRefusal } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useComposed, useModule } from './composition';
import { onDeviceNotificationTap } from './device-notifications';
import { editionStrings } from './edition';
import { notificationsSummary } from './notifications-screen';

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

/** The Notification times and the sound as they stand, kept up to date; nothing until they open. */
export function useNotificationsState(): NotificationsState | undefined {
  return useComposed(
    (composition) => composition.notifications,
    (notifications): NotificationsState | undefined => notifications.state,
    undefined,
  );
}

/** The value of the «Сповіщення» row of Settings; nothing until Notifications open. */
export function useNotificationsSummary(): string | undefined {
  const state = useNotificationsState();
  const { count } = useEdition();
  return useMemo(
    () =>
      state === undefined
        ? undefined
        : notificationsSummary({
            notifications: state,
            strings: editionStrings.notifications,
            count,
          }),
    [state, count],
  );
}

/**
 * The calls that change the Notification times and the sound. A change that
 * could not be kept is logged and leaves things as they were.
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
} {
  const notifications = useModule((composition) => composition.notifications);
  const keep = (change: Promise<unknown> | undefined) => {
    change?.catch((error: unknown) => {
      console.error('Could not keep the change of the notifications', error);
    });
  };
  return {
    keepTime: async (time, replacing) => {
      try {
        return await notifications?.keepTime(time, replacing);
      } catch (error) {
        console.error('Could not keep the change of the notifications', error);
        return undefined;
      }
    },
    removeTime: (time) => {
      keep(notifications?.removeTime(time));
    },
    setSound: (on) => {
      keep(notifications?.setSound(on));
    },
  };
}
