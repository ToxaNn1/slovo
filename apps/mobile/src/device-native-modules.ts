import { requireOptionalNativeModule } from 'expo';
import { UIManager } from 'react-native';

import { createNativeModules } from './native-module';

/**
 * The native modules the installed binary has, looked up in its registries:
 * the Expo modules by name, and the time picker, a native view, in the view
 * manager registry. The widget needs two: `expo-file-system` for the App
 * Group's container and the Apple targets' storage module, which asks
 * WidgetKit to reload.
 */
export const nativeModules = createNativeModules({
  notifications: () =>
    requireOptionalNativeModule('ExpoNotificationScheduler') !== null &&
    requireOptionalNativeModule('ExpoNotificationPermissionsModule') !== null,
  timePicker: () => UIManager.hasViewManagerConfig('RNDateTimePicker'),
  widget: () =>
    requireOptionalNativeModule('FileSystem') !== null &&
    requireOptionalNativeModule('ExtensionStorage') !== null,
});
