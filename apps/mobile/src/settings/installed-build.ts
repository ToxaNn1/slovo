import { nativeModules } from '../device/device-native-modules';

/** What «Про застосунок» names of the code the app runs (ADR 0062). */
export interface InstalledBuild {
  /** The app version of the installed build, «0.9». */
  readonly version: string;
  /** The build number TestFlight accepted the build with. */
  readonly build: string;
  /** The id of the OTA update the app runs, or undefined while it runs without updates. */
  readonly updateId: string | undefined;
}

type ApplicationModule = typeof import('expo-application');
type UpdatesModule = typeof import('expo-updates');

/**
 * The installed build and the update it runs, as `expo-application` and
 * `expo-updates` report them, or undefined while the installed binary lacks
 * the module that reports the version (a dev client built before the 0.9
 * batch). Both modules are required here and nowhere else: a static import
 * of a module the binary lacks stops the app at start.
 */
export function installedBuild(): InstalledBuild | undefined {
  const application = nativeModules.load(
    'application',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-application') as ApplicationModule,
  );
  if (application === undefined) return undefined;
  const updates = nativeModules.load(
    'updates',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-updates') as UpdatesModule,
  );
  return {
    version: application.nativeApplicationVersion ?? '',
    build: application.nativeBuildVersion ?? '',
    updateId: updates?.updateId ?? undefined,
  };
}
