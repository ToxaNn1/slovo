import type { AppleSignInSheet } from '@slovo/core';

/** What the sheet uses of Expo's Apple authentication module. */
export type AppleAuthenticationModule = Pick<
  typeof import('expo-apple-authentication'),
  'signInAsync' | 'AppleAuthenticationScope'
>;

/** The code Expo's module rejects with when the reader dismisses Apple's sheet. */
const CANCELLED = 'ERR_REQUEST_CANCELED';

/** The code Expo's module rejects with on a device with no Apple sheet, such as Android. */
const UNAVAILABLE = 'ERR_UNAVAILABLE';

/** Whether Expo's module rejected with the code. */
function rejectedWith(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** Whether Expo's module rejected because the reader dismissed the sheet. */
function isCancelled(error: unknown): boolean {
  return rejectedWith(error, CANCELLED);
}

/**
 * The Core's Apple sign-in sheet port (ADR 0047) on Expo's Apple
 * authentication module: Apple's own sheet, asking for the email alone, so
 * the identity token names it, the reader's own or a private relay address.
 * A dismissed sheet is cancelled; any other failure, or a sign-in without an
 * identity token, is unexpected: Apple's module tells a lost network from
 * nothing else. Apple keeps nothing on the device for SLOVO to forget.
 * Before an Account with Apple is deleted it shows the sheet again, asking
 * for nothing, for the fresh authorization code the backend revokes with.
 */
export function createAppleSignInSheet(module: AppleAuthenticationModule): AppleSignInSheet {
  return {
    async signIn() {
      try {
        const { identityToken } = await module.signInAsync({
          requestedScopes: [module.AppleAuthenticationScope.EMAIL],
        });
        return identityToken === null
          ? { ok: false, reason: 'unexpected' }
          : { ok: true, idToken: identityToken };
      } catch (error) {
        return { ok: false, reason: isCancelled(error) ? 'cancelled' : 'unexpected' };
      }
    },

    async authorize() {
      try {
        const { authorizationCode } = await module.signInAsync({ requestedScopes: [] });
        return authorizationCode === null
          ? { ok: false, reason: 'unexpected' }
          : { ok: true, authorizationCode };
      } catch (error) {
        if (isCancelled(error)) return { ok: false, reason: 'cancelled' };
        return {
          ok: false,
          reason: rejectedWith(error, UNAVAILABLE) ? 'unavailable' : 'unexpected',
        };
      }
    },
  };
}

/**
 * The sheet of a build without Expo's Apple authentication module: a dev
 * client built before 0.9. An Apple sign-in fails as unexpected; the button
 * that starts one stays hidden there. Apple's sheet is unavailable to
 * authorize a deletion.
 */
export const noAppleSignInSheet: AppleSignInSheet = {
  signIn: () => Promise.resolve({ ok: false, reason: 'unexpected' }),
  authorize: () => Promise.resolve({ ok: false, reason: 'unavailable' }),
};
