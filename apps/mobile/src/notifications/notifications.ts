import type { NotificationSlot, NotificationsState, NotificationTimeRefusal } from '@slovo/core';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { notificationsSummary } from './notifications-summary';

/** The Notification times and the sound as they stand, kept up to date. */
export function useNotificationsState(): NotificationsState {
  return useSubscribed(useComposition().notifications, ({ state }) => state);
}

/** The value of the «Сповіщення» row of Settings: the Word's and the Reminder's times, or «Вимкнено». */
export function useNotificationsSummary(): string {
  const state = useNotificationsState();
  return useMemo(
    () => notificationsSummary({ notifications: state, strings: editionStrings.notifications }),
    [state],
  );
}

/**
 * The calls that switch notifications, change their times and the sound, and ask for
 * permission. A change that could not be kept is logged and leaves things as
 * they were.
 */
export function useNotificationsChanges(): {
  /**
   * Keeps the time the reader picked for the Word or the Reminder. Resolves
   * to why it was refused, or nothing when it is kept or could not be written.
   */
  keepTime: (slot: NotificationSlot, time: string) => Promise<NotificationTimeRefusal | undefined>;
  setOn: (on: boolean) => void;
  setSound: (on: boolean) => void;
  /** Asks the reader for permission to notify; a grant plans the notifications. */
  askPermission: () => void;
} {
  const { notifications } = useComposition();
  const subject = 'the notifications';
  return {
    keepTime: (slot, time) => keep(subject, notifications.keepTime(slot, time)),
    setOn: (on) => {
      void keep(subject, notifications.setOn(on));
    },
    setSound: (on) => {
      void keep(subject, notifications.setSound(on));
    },
    askPermission: () => {
      void keep(subject, notifications.askPermission());
    },
  };
}
