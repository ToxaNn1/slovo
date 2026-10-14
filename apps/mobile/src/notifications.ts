import type { Notifications, NotificationsState, NotificationTimeRefusal } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposed, useModule } from './composition';
import { editionStrings } from './edition';
import { keepPickedTime, notificationsSummary } from './notifications-screen';

/** Notifications of the session's Core composition, once it is open. */
function useNotifications(): Notifications | undefined {
  return useModule((composition) => composition.notifications);
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
   * Keeps the time the reader picked: it replaces the time `from`, or is
   * added without one. Resolves to why it was refused, or nothing when it is
   * kept or could not be written.
   */
  keepTime: (picked: Date, from?: string) => Promise<NotificationTimeRefusal | undefined>;
  removeTime: (time: string) => void;
  setSound: (on: boolean) => void;
} {
  const notifications = useNotifications();
  const keep = (change: Promise<unknown> | undefined) => {
    change?.catch((error: unknown) => {
      console.error('Could not keep the change of the notifications', error);
    });
  };
  return {
    keepTime: async (picked, from) => {
      if (notifications === undefined) return undefined;
      try {
        return await keepPickedTime({
          notifications,
          picked,
          ...(from === undefined ? {} : { from }),
        });
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
