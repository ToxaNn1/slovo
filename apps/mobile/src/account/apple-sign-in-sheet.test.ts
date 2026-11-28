import { describe, expect, it } from 'vitest';

import {
  createAppleSignInSheet,
  noAppleSignInSheet,
  type AppleAuthenticationModule,
} from './apple-sign-in-sheet';

/** A rejection of Expo's Apple authentication module, with the code it names. */
const moduleError = (code: string) => Object.assign(new Error(code), { code });

/** Expo's Apple authentication module, faked: `signInAsync` answers what the test says, and keeps what it was asked for. */
function appleModule(signInAsync: () => Promise<unknown>) {
  const asked: unknown[] = [];
  const module = {
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    signInAsync: (options: unknown) => {
      asked.push(options);
      return signInAsync();
    },
  } as unknown as AppleAuthenticationModule;
  return { module, asked };
}

describe("Apple's own sign-in sheet behind «Увійти через Apple»", () => {
  it("hands the Account the identity token from Apple's sheet, asking for the email alone", async () => {
    const { module, asked } = appleModule(() =>
      Promise.resolve({
        user: '001234.abc',
        identityToken: 'apple-id-token:anna@mail.com',
        authorizationCode: 'code',
        email: 'anna@mail.com',
      }),
    );

    await expect(createAppleSignInSheet(module).signIn()).resolves.toEqual({
      ok: true,
      idToken: 'apple-id-token:anna@mail.com',
    });
    expect(asked).toEqual([{ requestedScopes: [1] }]);
  });

  it('answers cancelled when the reader dismisses the sheet', async () => {
    const { module } = appleModule(() => Promise.reject(moduleError('ERR_REQUEST_CANCELED')));

    await expect(createAppleSignInSheet(module).signIn()).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
    });
  });

  it('answers unexpected when the sheet fails otherwise', async () => {
    const { module } = appleModule(() => Promise.reject(moduleError('ERR_REQUEST_FAILED')));

    await expect(createAppleSignInSheet(module).signIn()).resolves.toEqual({
      ok: false,
      reason: 'unexpected',
    });
  });

  it('answers unexpected when Apple signs in without an identity token', async () => {
    const { module } = appleModule(() =>
      Promise.resolve({ user: '001234.abc', identityToken: null, authorizationCode: 'code' }),
    );

    await expect(createAppleSignInSheet(module).signIn()).resolves.toEqual({
      ok: false,
      reason: 'unexpected',
    });
  });
});

describe("Apple's sheet again before an Account with Apple is deleted", () => {
  it("hands the Account Apple's fresh authorization code, asking for nothing more", async () => {
    const { module, asked } = appleModule(() =>
      Promise.resolve({
        user: '001234.abc',
        identityToken: 'token',
        authorizationCode: 'fresh-code',
      }),
    );

    await expect(createAppleSignInSheet(module).authorize()).resolves.toEqual({
      ok: true,
      authorizationCode: 'fresh-code',
    });
    expect(asked).toEqual([{ requestedScopes: [] }]);
  });

  it('answers cancelled when the reader dismisses the sheet', async () => {
    const { module } = appleModule(() => Promise.reject(moduleError('ERR_REQUEST_CANCELED')));

    await expect(createAppleSignInSheet(module).authorize()).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
    });
  });

  it('answers unavailable on a device with no Apple sheet', async () => {
    const { module } = appleModule(() => Promise.reject(moduleError('ERR_UNAVAILABLE')));

    await expect(createAppleSignInSheet(module).authorize()).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('answers unexpected when the sheet fails otherwise, or Apple hands out no code', async () => {
    const failing = appleModule(() => Promise.reject(moduleError('ERR_REQUEST_FAILED')));
    const codeless = appleModule(() =>
      Promise.resolve({ user: '001234.abc', identityToken: 'token', authorizationCode: null }),
    );

    await expect(createAppleSignInSheet(failing.module).authorize()).resolves.toEqual({
      ok: false,
      reason: 'unexpected',
    });
    await expect(createAppleSignInSheet(codeless.module).authorize()).resolves.toEqual({
      ok: false,
      reason: 'unexpected',
    });
  });

  it('answers unavailable in a build without the module', async () => {
    await expect(noAppleSignInSheet.authorize()).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
