import type { AppleSignInSheet } from '@slovo/core';

/** What the sheet uses of Expo's Apple authentication module. */
export type AppleAuthenticationModule = Pick<
  typeof import('expo-apple-authentication'),
  'signInAsync' | 'AppleAuthenticationScope'
>;

/** The code Expo's module rejects with when the reader dismisses Apple's sheet. */
const CANCELLED = 'ERR_REQUEST_CANCELED';

/** Whether Expo's module rejected because the reader dismissed the sheet. */
function isCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === CANCELLED;
}

/**
 * The Core's Apple sign-in sheet port (ADR 0047) on Expo's Apple
 * authentication module: Apple's own sheet, asking for the email alone, so
 * the identity token names it, the reader's own or a private relay address.
 * A dismissed sheet is cancelled; any other failure, or a sign-in without an
 * identity token, is unexpected: Apple's module tells a lost network from
 * nothing else. Apple keeps nothing on the device for SLOVO to forget.
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
  };
}

/**
 * The sheet of a build without Expo's Apple authentication module: a dev
 * client built before 0.9. An Apple sign-in fails as unexpected; the button
 * that starts one stays hidden there.
 */
export const noAppleSignInSheet: AppleSignInSheet = {
  signIn: () => Promise.resolve({ ok: false, reason: 'unexpected' }),
};
