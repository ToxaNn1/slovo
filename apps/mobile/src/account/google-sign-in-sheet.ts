import type { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { GoogleSignInSheet } from '@slovo/core';

/** What the sheet uses of Google's sign-in SDK for React Native. */
export type GoogleSignInSdk = Pick<
  typeof GoogleSignin,
  'configure' | 'signIn' | 'signOut' | 'revokeAccess'
>;

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
 * React Native, as the app loads it, for the app's OAuth client id for iOS: Google's own native
 * sheet, configured at its first showing. The SDK answers a dismissed sheet
 * as cancelled; an error of the network is offline, and any other error, or a
 * sign-in without an identity token, is unexpected. It asks for Google's
 * default scopes: the iOS SDK always adds `email` and `profile`, so no
 * narrower request is possible. Forgetting the sign-in signs out of the SDK,
 * which drops the Google user it keeps in the Keychain; revoking first takes
 * back the reader's grant at Google too. A failure of either changes nothing.
 */
export function createGoogleSignInSheet(
  sdk: GoogleSignInSdk,
  iosClientId: string,
): GoogleSignInSheet {
  let configured = false;
  return {
    async signIn() {
      try {
        if (!configured) {
          sdk.configure({ iosClientId });
          configured = true;
        }
        const response = await sdk.signIn();
        if (response.type === 'cancelled') return { ok: false, reason: 'cancelled' };
        const { idToken } = response.data;
        return idToken === null ? { ok: false, reason: 'unexpected' } : { ok: true, idToken };
      } catch (error) {
        return { ok: false, reason: isNetworkError(error) ? 'offline' : 'unexpected' };
      }
    },
    async forget({ revoke }) {
      if (revoke) await sdk.revokeAccess().catch(() => undefined);
      await sdk.signOut().catch(() => undefined);
    },
  };
}

/**
 * The sheet of a build without Google's: one without a client id, or whose
 * binary lacks the SDK's native module. A Google sign-in fails as unexpected;
 * the button that starts one stays hidden there.
 */
export const noGoogleSignInSheet: GoogleSignInSheet = {
  signIn: () => Promise.resolve({ ok: false, reason: 'unexpected' }),
  forget: () => Promise.resolve(),
};
