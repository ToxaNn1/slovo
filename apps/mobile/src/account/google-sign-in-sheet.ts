import type { GoogleSignInSheet } from '@slovo/core';

/**
 * The Core's Google sign-in sheet port (ADR 0047) on this device. Until the
 * adapter for Google's sign-in SDK lands (#613) the binary has no sheet, so a
 * Google sign-in fails as unexpected; the button that starts one stays hidden
 * while the build has no Google client id (#612).
 */
export const googleSignInSheet: GoogleSignInSheet = {
  signIn: () => Promise.resolve({ ok: false, reason: 'unexpected' }),
};
