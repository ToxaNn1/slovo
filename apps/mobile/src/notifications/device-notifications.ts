import { isRunningInExpoGo } from 'expo';

import { nativeModules } from '../device/device-native-modules';
import { activeEditionId } from '../edition/edition';
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
  inExpoGo: isRunningInExpoGo(),
});

/** Calls `open` with the link of each active Edition's notification the reader taps; returns the call that stops it. */
export const onDeviceNotificationTap = (open: (link: string) => void) =>
  onNotificationTap(notifications, activeEditionId, open);
