import {
  formatTimeOfDay,
  parseLocalDate,
  parseTimeOfDay,
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

/** The local time of day a picked date stands for, as a Notification time `HH:MM`. */
export function timeOfDay(date: Date): string {
  return formatTimeOfDay({ hour: date.getHours(), minute: date.getMinutes() });
}

/** The Notification time `HH:MM` on the day of `day`, for the picker to start from. */
export function dateOfTime(time: string, day: Date): Date {
  const { hour, minute } = parseTimeOfDay(time);
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** The value of the search param `from` that marks an Entry link as a notification's. */
const notificationSource = 'notification';

/** The Expo Router link of a notification's Word: the Entry screen, opened as from a notification. */
function notificationLink(wordId: string): string {
  return `/entry/${encodeURIComponent(wordId)}?from=${notificationSource}`;
}

/** Whether the search params of an Entry link mark it as a notification's link. */
export function isFromNotification({ from }: { readonly from?: string }): boolean {
  return from === notificationSource;
}

/** Where the app runs, as far as scheduling cares. */
export interface NotificationEnvironment {
  /**
   * Whether it is Expo Go. Expo Go never runs the `expo-notifications` config
   * plugin that bundles the Edition's sound file (ADR 0023), so there the file
   * can't be asked for by name.
   */
  readonly inExpoGo: boolean;
}

/**
 * The notification scheduler port on `expo-notifications`, or, when the
 * installed binary lacks the module (`notifications` is undefined), a port
 * that reports not asked yet, asks nothing and schedules nothing.
 *
 * Where the Edition's sound file is not in the app, a notification that wants
 * it plays the system sound instead.
 *
 * Each notification comes on a calendar trigger built from its local date and
 * time parts with no time zone, so iOS fires it at that wall-clock time in
 * whatever zone the device is in (ADR 0021).
 */
export function createNotificationScheduler(
  notifications: NotificationsModule | undefined,
  environment: NotificationEnvironment,
): NotificationSchedulerPort {
  if (notifications === undefined) {
    return {
      permission: () => Promise.resolve('not-asked'),
      askPermission: () => Promise.resolve('not-asked'),
      replacePlan: () => Promise.resolve(),
    };
  }
  return schedulerOn(notifications, environment);
}

function schedulerOn(
  notifications: NotificationsModule,
  { inExpoGo }: NotificationEnvironment,
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
    return sound === 'system' || inExpoGo ? 'default' : sound.file;
  }

  function schedule({ date, time, title, body, wordId, sound }: PlannedNotification) {
    const { year, month, day } = parseLocalDate(date);
    const { hour, minute } = parseTimeOfDay(time);
    return notifications.scheduleNotificationAsync({
      identifier: `${date}T${time}`,
      content: {
        title,
        body,
        sound: soundOf(sound),
        // The farewell carries no Word: a tap on it only opens the app.
        data: wordId === undefined ? {} : { wordId },
      },
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
 * Calls `open` with the link of the Word of each notification the reader
 * taps: the one that launched the app, once, and each tap while it runs.
 * Returns the call that stops listening. Without the module there is nothing
 * to listen to.
 */
export function onNotificationTap(
  notifications: NotificationsModule | undefined,
  open: (link: string) => void,
): () => void {
  if (notifications === undefined) return () => undefined;
  // iOS keeps the last tap until it is cleared, so listening again, as after
  // a remount, doesn't open the same Word twice.
  function opened(response: ExpoNotifications.NotificationResponse | null): void {
    const wordId = wordOf(response);
    if (wordId === undefined) return;
    notifications?.clearLastNotificationResponse();
    open(notificationLink(wordId));
  }
  opened(notifications.getLastNotificationResponse());
  const subscription = notifications.addNotificationResponseReceivedListener(opened);
  return () => {
    subscription.remove();
  };
}
