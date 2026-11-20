import { beforeEach, describe, expect, it } from 'vitest';

import { createGoogleSignInSheet, type GoogleSignInSdk } from './google-sign-in-sheet';

/**
 * Google's sign-in SDK for React Native, faked: its sheet answers what
 * `googleSdk.signIn` answers, as the SDK's own `signIn` resolves or rejects,
 * and `googleSdk.told` keeps each sign-out and revoke the SDK was told,
 * which answer what `googleSdk.forgets` answers.
 */
const googleSdk = {
  signIn: (): Promise<unknown> => Promise.resolve({ type: 'cancelled', data: null }),
  forgets: (): Promise<null> => Promise.resolve(null),
  told: [] as string[],
  /** The Google user the SDK holds this run, and whether it kept one in the Keychain from before. */
  currentUser: null as object | null,
  previousSignIn: false,
};
const GoogleSignin = {
  configure: () => {
    googleSdk.told.push('configure');
  },
  signIn: () => googleSdk.signIn(),
  getCurrentUser: () => googleSdk.currentUser,
  hasPreviousSignIn: () => googleSdk.previousSignIn,
  signInSilently: () => {
    googleSdk.told.push('signInSilently');
    googleSdk.currentUser = {};
    return Promise.resolve({ type: 'success', data: {} });
  },
  signOut: () => {
    googleSdk.told.push('signOut');
    return googleSdk.forgets();
  },
  revokeAccess: () => {
    googleSdk.told.push('revokeAccess');
    return googleSdk.forgets();
  },
} as unknown as GoogleSignInSdk;

/** A rejection of Google's SDK on iOS, as React Native hands over the native error. */
const sdkError = (domain: string, code: string) =>
  Object.assign(new Error(`${domain} ${code}`), { domain, code });

/** A client id of the shape Google gives an iOS app; no real one. */
const CLIENT_ID = '123456789012-test.apps.googleusercontent.com';

beforeEach(() => {
  googleSdk.forgets = () => Promise.resolve(null);
  googleSdk.told = [];
  googleSdk.currentUser = null;
  googleSdk.previousSignIn = false;
});

describe("Google's own sign-in sheet behind «Увійти через Google»", () => {
  const googleSheet = createGoogleSignInSheet(GoogleSignin, CLIENT_ID);

  it("hands the Account the identity token from Google's sheet", async () => {
    googleSdk.signIn = () =>
      Promise.resolve({
        type: 'success',
        data: { idToken: 'google-id-token:anna@mail.com', user: { email: 'anna@mail.com' } },
      });

    await expect(googleSheet.signIn()).resolves.toEqual({
      ok: true,
      idToken: 'google-id-token:anna@mail.com',
    });
  });

  it('answers cancelled when the reader dismisses the sheet', async () => {
    googleSdk.signIn = () => Promise.resolve({ type: 'cancelled', data: null });

    await expect(googleSheet.signIn()).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });

  it('answers offline when the sheet finds no network', async () => {
    googleSdk.signIn = () => Promise.reject(sdkError('NSURLErrorDomain', '-1009'));

    await expect(googleSheet.signIn()).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('answers unexpected when the sheet fails otherwise', async () => {
    googleSdk.signIn = () => Promise.reject(sdkError('com.google.GIDSignIn', '-2'));

    await expect(googleSheet.signIn()).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });

  it('answers unexpected when Google signs in without an identity token', async () => {
    googleSdk.signIn = () =>
      Promise.resolve({
        type: 'success',
        data: { idToken: null, user: { email: 'anna@mail.com' } },
      });

    await expect(googleSheet.signIn()).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });

  it('signs out of Google when the Session ends, and revokes the grant too when the Account is deleted', async () => {
    await googleSheet.signIn();
    await googleSheet.forget({ revoke: false });
    expect(googleSdk.told).toEqual(['signOut']);

    // Signed in this run: the SDK is configured and holds the Google user.
    googleSdk.told = [];
    googleSdk.currentUser = {};
    await googleSheet.forget({ revoke: true });
    expect(googleSdk.told).toEqual(['revokeAccess', 'signOut']);
  });

  it('restores the sign-in kept from before a restart, then revokes the grant and signs out', async () => {
    const afterRestart = createGoogleSignInSheet(GoogleSignin, CLIENT_ID);
    googleSdk.previousSignIn = true;

    await afterRestart.forget({ revoke: true });

    expect(googleSdk.told).toEqual(['configure', 'signInSilently', 'revokeAccess', 'signOut']);
  });

  it('revokes with nothing to restore when Google kept no sign-in', async () => {
    const afterRestart = createGoogleSignInSheet(GoogleSignin, CLIENT_ID);

    await afterRestart.forget({ revoke: true });

    expect(googleSdk.told).toEqual(['configure', 'revokeAccess', 'signOut']);
  });

  it("goes on when Google's SDK fails to forget the sign-in", async () => {
    googleSdk.forgets = () => Promise.reject(sdkError('NSURLErrorDomain', '-1009'));

    await expect(googleSheet.forget({ revoke: false })).resolves.toBeUndefined();
    await expect(googleSheet.forget({ revoke: true })).resolves.toBeUndefined();
  });
});
