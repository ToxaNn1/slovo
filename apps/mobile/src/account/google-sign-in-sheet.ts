import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { GoogleSignInSheet } from '@slovo/core';

const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * The build's Google client id for iOS (ADR 0047), from its environment and
 * never the repository, or undefined when the build has none.
 * «Увійти через Google» shows only with one.
 */
export const googleClientId: string | undefined =
  clientId === undefined || clientId === '' ? undefined : clientId;

/** The domain of the errors iOS gives when a request finds no network or loses it. */
const NETWORK_ERROR_DOMAIN = 'NSURLErrorDomain';

/** Whether Google's SDK rejected with an error of iOS's networking, as React Native hands it over. */
function isNetworkError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'domain' in error &&
    error.domain === NETWORK_ERROR_DOMAIN
  );
}

/**
 * The Core's Google sign-in sheet port (ADR 0047) on Google's sign-in SDK for
 * React Native, for the app's OAuth client id for iOS: Google's own native
 * sheet, configured at its first showing. The SDK answers a dismissed sheet
 * as cancelled; an error of the network is offline, and any other error, or a
 * sign-in without an identity token, is unexpected. It asks for Google's
 * default scopes: the iOS SDK always adds `email` and `profile`, so no
 * narrower request is possible. Forgetting the sign-in signs out of the SDK,
 * which drops the Google user it keeps in the Keychain; revoking first takes
 * back the reader's grant at Google too. A failure of either changes nothing.
 */
export function createGoogleSignInSheet(iosClientId: string): GoogleSignInSheet {
  let configured = false;
  return {
    async signIn() {
      try {
        if (!configured) {
          GoogleSignin.configure({ iosClientId });
          configured = true;
        }
        const response = await GoogleSignin.signIn();
        if (response.type === 'cancelled') return { ok: false, reason: 'cancelled' };
        const { idToken } = response.data;
        return idToken === null ? { ok: false, reason: 'unexpected' } : { ok: true, idToken };
      } catch (error) {
        return { ok: false, reason: isNetworkError(error) ? 'offline' : 'unexpected' };
      }
    },
    async forget({ revoke }) {
      if (revoke) await GoogleSignin.revokeAccess().catch(() => undefined);
      await GoogleSignin.signOut().catch(() => undefined);
    },
  };
}

/**
 * The Google sign-in sheet of this device: Google's own, for the build's
 * client id. A build without one has no sheet, so a Google sign-in fails as
 * unexpected; the button that starts one stays hidden there.
 */
export const googleSignInSheet: GoogleSignInSheet =
  googleClientId === undefined
    ? {
        signIn: () => Promise.resolve({ ok: false, reason: 'unexpected' }),
        forget: () => Promise.resolve(),
      }
    : createGoogleSignInSheet(googleClientId);
