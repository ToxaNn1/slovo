import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGoogleSignInSheet } from './google-sign-in-sheet';

/**
 * Google's sign-in SDK for React Native, faked: its sheet answers what
 * `googleSdk.signIn` answers, as the SDK's own `signIn` resolves or rejects,
 * and `googleSdk.told` keeps each sign-out and revoke the SDK was told,
 * which answer what `googleSdk.forgets` answers.
 */
const googleSdk = vi.hoisted(() => ({
  signIn: (): Promise<unknown> => Promise.resolve({ type: 'cancelled', data: null }),
  forgets: (): Promise<null> => Promise.resolve(null),
  told: [] as string[],
}));
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: () => undefined,
    signIn: () => googleSdk.signIn(),
    signOut: () => {
      googleSdk.told.push('signOut');
      return googleSdk.forgets();
    },
    revokeAccess: () => {
      googleSdk.told.push('revokeAccess');
      return googleSdk.forgets();
    },
  },
}));

/** A rejection of Google's SDK on iOS, as React Native hands over the native error. */
const sdkError = (domain: string, code: string) =>
  Object.assign(new Error(`${domain} ${code}`), { domain, code });

/** A client id of the shape Google gives an iOS app; no real one. */
const CLIENT_ID = '123456789012-test.apps.googleusercontent.com';

beforeEach(() => {
  googleSdk.forgets = () => Promise.resolve(null);
  googleSdk.told = [];
});

describe("Google's own sign-in sheet behind «Увійти через Google»", () => {
  const googleSheet = createGoogleSignInSheet(CLIENT_ID);

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
    await googleSheet.forget({ revoke: false });
    expect(googleSdk.told).toEqual(['signOut']);

    googleSdk.told = [];
    await googleSheet.forget({ revoke: true });
    expect(googleSdk.told).toContain('revokeAccess');
  });

  it("goes on when Google's SDK fails to forget the sign-in", async () => {
    googleSdk.forgets = () => Promise.reject(sdkError('NSURLErrorDomain', '-1009'));

    await expect(googleSheet.forget({ revoke: false })).resolves.toBeUndefined();
    await expect(googleSheet.forget({ revoke: true })).resolves.toBeUndefined();
  });
});
