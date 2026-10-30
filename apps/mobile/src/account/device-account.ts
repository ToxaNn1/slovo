import { openAccount, systemRandom, type Account, type TrackedUserState } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { backend } from '../api';
import { deviceClock } from '../device/device-clock';
import { nativeModules } from '../device/device-native-modules';
import { edition } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';
import { createGoogleSignInSheet, noGoogleSignInSheet } from './google-sign-in-sheet';
import { createSessionStore } from './session-store';

/**
 * `expo-secure-store`, or undefined while the installed binary lacks it (a dev
 * client built before the 0.7 batch). It is required here and nowhere else:
 * a static import would stop the app at start.
 */
const keychain = nativeModules.load(
  'keychain',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-secure-store') as typeof import('expo-secure-store'),
);

type GoogleSdkModule = typeof import('@react-native-google-signin/google-signin');

const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * Google's sign-in SDK, or undefined while the installed binary lacks its
 * native module (a dev client built before the 0.8.9 batch). Like the
 * Keychain, it is required here and nowhere else.
 */
const googleSdk = nativeModules.load(
  'googleSignIn',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => (require('@react-native-google-signin/google-signin') as GoogleSdkModule).GoogleSignin,
);

/**
 * The build's Google client id for iOS (ADR 0047), from its environment and
 * never the repository, or undefined when the build has none or its binary
 * lacks Google's SDK. «Увійти через Google» shows only with one.
 */
export const googleClientId: string | undefined =
  clientId === undefined || clientId === '' || googleSdk === undefined ? undefined : clientId;

/**
 * The Google sign-in sheet of this device: Google's own, for the build's
 * client id, or the sheet of a build without Google's.
 */
const googleSignInSheet =
  googleClientId === undefined || googleSdk === undefined
    ? noGoogleSignInSheet
    : createGoogleSignInSheet(googleSdk, googleClientId);

/**
 * The reader's Account («SLOVO ID»), opened once per app run apart from the
 * composition (ADR 0036, 0037), or undefined when the Edition's `account`
 * switch is off. Its Session is in the Keychain, or in memory while the
 * binary lacks it. When the Keychain can't be read, the opening fails with a
 * retry, so a Session kept there is never shadowed by one in memory. It opens
 * after the user state, whose installed marker tells a Session of this install
 * from one an earlier install left in the Keychain.
 */
export function accountOpening({
  userState,
}: {
  userState: Opening<TrackedUserState>;
}): Opening<Account> | undefined {
  if (!edition.isFeatureEnabled('account')) return undefined;
  return openOnce(
    async () =>
      openAccount({
        backend,
        edition,
        googleSheet: googleSignInSheet,
        sessions: createSessionStore(keychain),
        userState: await userState.opened(),
        clock: deviceClock,
        schedule: systemSchedule,
        random: systemRandom,
      }),
    {
      onError(error) {
        logError('Could not read the Session', error);
      },
    },
  );
}
