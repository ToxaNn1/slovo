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
  /**
   * The local day the update the app runs was made, or undefined while it
   * runs the code it shipped with, under Expo Go and on a binary that lacks
   * `expo-updates`. Never the update's id, which tells the reader nothing.
   */
  readonly updatedOn: { readonly day: number; readonly month: number } | undefined;
}

type ApplicationModule = typeof import('expo-application');
type UpdatesModule = typeof import('expo-updates');

/** The local day `expo-updates` says the running update was made, when it runs one. */
function updatedOn(): InstalledBuild['updatedOn'] {
  const updates = nativeModules.load(
    'updates',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-updates') as UpdatesModule,
  );
  const createdAt = updates?.isEmbeddedLaunch === false ? updates.createdAt : null;
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) return undefined;
  return { day: createdAt.getDate(), month: createdAt.getMonth() + 1 };
}

/**
 * The EAS Update channel the binary was built for (`beta`, `production`), or
 * null in a development build, under Expo Go and on a binary that lacks
 * `expo-updates`. Crash reports name their environment by it (ADR 0048).
 */
export function updateChannel(): string | null {
  const updates = nativeModules.load(
    'updates',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-updates') as UpdatesModule,
  );
  return updates?.channel ?? null;
}

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
    return { version, build: undefined, updatedOn: undefined };
  }
  const application = nativeModules.load(
    'application',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-application') as ApplicationModule,
  );
  const build = application?.nativeBuildVersion ?? undefined;
  return { version, build: build === '' ? undefined : build, updatedOn: updatedOn() };
}
