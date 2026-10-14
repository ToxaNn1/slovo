import { nativeModules } from './device-native-modules';
import { edition } from './edition';
import {
  createNotificationScheduler,
  onNotificationTap,
  type NotificationsModule,
} from './notification-scheduler';

/**
 * `expo-notifications`, or undefined when the installed binary lacks it (a
 * dev client built before the 0.4 batch). The module is required here and
 * nowhere else: a static import would stop the app at start.
 */
const notifications = nativeModules.load(
  'notifications',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-notifications') as NotificationsModule,
);

/** The notification scheduler the composition plans on: the device's, or one that stays not asked. */
export const deviceNotificationScheduler = createNotificationScheduler(notifications, {
  editionSound: edition.notificationSound,
});

/** Calls `open` with the Word of each notification the reader taps; returns the call that stops it. */
export const onDeviceNotificationTap = (open: (wordId: string) => void) =>
  onNotificationTap(notifications, open);
