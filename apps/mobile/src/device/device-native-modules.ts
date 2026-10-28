import { requireOptionalNativeModule } from 'expo';
import { TurboModuleRegistry, UIManager } from 'react-native';

import { createNativeModules } from './native-module';

/**
 * The native modules the installed binary has, looked up in its registries:
 * the Expo modules by name, the time picker, a native view, in the view
 * manager registry, and the view capture of the Share Card in the module
 * registry. The widget needs two: `expo-file-system` for the App Group's
 * container and the Apple targets' storage module, which asks WidgetKit to
 * reload. Sharing needs the view capture, with `expo-file-system` to move
 * its image into the cache. Content updates need `expo-file-system` to keep
 * a downloaded Language Pack, and the Session needs `expo-secure-store`, the
 * Keychain. Google sign-in needs Google's SDK, a module of the registry. The iPhone search needs the app's own
 * Spotlight module (`modules/spotlight`).
 */
export const nativeModules = createNativeModules({
  notifications: () =>
    requireOptionalNativeModule('ExpoNotificationScheduler') !== null &&
    requireOptionalNativeModule('ExpoNotificationPermissionsModule') !== null,
  timePicker: () => UIManager.hasViewManagerConfig('RNDateTimePicker'),
  widget: () =>
    requireOptionalNativeModule('FileSystem') !== null &&
    requireOptionalNativeModule('ExtensionStorage') !== null,
  shareCapture: () =>
    TurboModuleRegistry.get('RNViewShot') !== null &&
    requireOptionalNativeModule('FileSystem') !== null,
  contentUpdates: () => requireOptionalNativeModule('FileSystem') !== null,
  keychain: () => requireOptionalNativeModule('ExpoSecureStore') !== null,
  googleSignIn: () => TurboModuleRegistry.get('RNGoogleSignin') !== null,
  spotlight: () => requireOptionalNativeModule('SlovoSpotlight') !== null,
});
