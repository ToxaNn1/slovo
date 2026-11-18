import Constants, { ExecutionEnvironment } from 'expo-constants';

import { nativeModules } from '../device/device-native-modules';

/** What «Про SLOVO» names of the code the app runs (ADR 0062). */
export interface InstalledBuild {
  /** The app's own version, from its app config, «0.9». */
  readonly version: string;
  /**
   * The build number TestFlight accepted the build with, or undefined under
   * Expo Go, whose binary is not the app's, and on a binary that lacks the
   * module reporting it.
   */
  readonly build: string | undefined;
}

type ApplicationModule = typeof import('expo-application');

/**
 * The app's version, as its app config names it, and the build number
 * `expo-application` reports. The native version is not read: under Expo Go
 * it is Expo Go's own («58.0.7»). `expo-application` is required here and
 * nowhere else: a static import of a module the binary lacks stops the app at
 * start.
 */
export function installedBuild(): InstalledBuild {
  const version = Constants.expoConfig?.version ?? '';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { version, build: undefined };
  }
  const application = nativeModules.load(
    'application',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-application') as ApplicationModule,
  );
  const build = application?.nativeBuildVersion ?? undefined;
  return { version, build: build === '' ? undefined : build };
}
