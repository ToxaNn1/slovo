import {
  parseLocalDate,
  type NotificationPermission,
  type NotificationSchedulerPort,
  type PlannedNotification,
  type PlannedSound,
} from '@slovo/core';
import type * as ExpoNotifications from 'expo-notifications';

/** What the shell uses of `expo-notifications`. */
export type NotificationsModule = Pick<
  typeof ExpoNotifications,
  | 'PermissionStatus'
  | 'SchedulableTriggerInputTypes'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'cancelAllScheduledNotificationsAsync'
  | 'scheduleNotificationAsync'
  | 'getLastNotificationResponse'
  | 'clearLastNotificationResponse'
  | 'addNotificationResponseReceivedListener'
>;

/** The Edition's notification sound, the file the expo-notifications config plugin bundles; none without one. */
interface SchedulerSounds {
  readonly editionSound: string | undefined;
}

/** The Expo Router link of a notification's Word: the Entry screen, opened as from a notification. */
export function notificationLink(wordId: string): string {
  return `/entry/${encodeURIComponent(wordId)}?from=notification`;
}

/**
 * The notification scheduler port on `expo-notifications`, or, when the
 * installed binary lacks the module (`notifications` is undefined), a port
 * that reports not asked yet, asks nothing and schedules nothing.
 *
 * Each notification comes on a calendar trigger built from its local date and
 * time parts with no time zone, so iOS fires it at that wall-clock time in
 * whatever zone the device is in (ADR 0021).
 */
export function createNotificationScheduler(
  notifications: NotificationsModule | undefined,
  sounds: SchedulerSounds,
): NotificationSchedulerPort {
  if (notifications === undefined) {
    return {
      permission: () => Promise.resolve('not-asked'),
      askPermission: () => Promise.resolve('not-asked'),
      replacePlan: () => Promise.resolve(),
    };
  }
  return schedulerOn(notifications, sounds);
}

function schedulerOn(
  notifications: NotificationsModule,
  { editionSound }: SchedulerSounds,
): NotificationSchedulerPort {
  const { PermissionStatus, SchedulableTriggerInputTypes } = notifications;

  function permissionOf({
    status,
  }: ExpoNotifications.NotificationPermissionsStatus): NotificationPermission {
    if (status === PermissionStatus.GRANTED) return 'allowed';
    return status === PermissionStatus.DENIED ? 'denied' : 'not-asked';
  }

  function soundOf(sound: PlannedSound): string | false {
    if (sound === 'silent') return false;
    return sound === 'edition' && editionSound !== undefined ? editionSound : 'default';
  }

  function schedule({ date, time, title, body, wordId, sound }: PlannedNotification) {
    const { year, month, day } = parseLocalDate(date);
    const [hour = 0, minute = 0] = time.split(':').map(Number);
    return notifications.scheduleNotificationAsync({
      identifier: `${date}T${time}`,
      content: { title, body, sound: soundOf(sound), data: { wordId } },
      trigger: { type: SchedulableTriggerInputTypes.CALENDAR, year, month, day, hour, minute },
    });
  }

  async function permission(): Promise<NotificationPermission> {
    return permissionOf(await notifications.getPermissionsAsync());
  }

  return {
    permission,
    async askPermission() {
      const current = await permission();
      if (current !== 'not-asked') return current;
      return permissionOf(
        await notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true },
        }),
      );
    },
    async replacePlan(plan) {
      await notifications.cancelAllScheduledNotificationsAsync();
      await Promise.all(plan.map(schedule));
    },
  };
}

/** The Word a tapped notification carries, if it carries one. */
function wordOf(response: ExpoNotifications.NotificationResponse | null): string | undefined {
  const wordId = response?.notification.request.content.data?.['wordId'];
  return typeof wordId === 'string' ? wordId : undefined;
}

/**
 * Calls `open` with the Word of each notification the reader taps: the one
 * that launched the app, once, and each tap while it runs. Returns the call
 * that stops listening. Without the module there is nothing to listen to.
 */
export function onNotificationTap(
  notifications: NotificationsModule | undefined,
  open: (wordId: string) => void,
): () => void {
  if (notifications === undefined) return () => undefined;
  // iOS keeps the last tap until it is cleared, so listening again, as after
  // a remount, doesn't open the same Word twice.
  function opened(response: ExpoNotifications.NotificationResponse | null): void {
    const wordId = wordOf(response);
    if (wordId === undefined) return;
    notifications?.clearLastNotificationResponse();
    open(wordId);
  }
  opened(notifications.getLastNotificationResponse());
  const subscription = notifications.addNotificationResponseReceivedListener(opened);
  return () => {
    subscription.remove();
  };
}
