import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { passTime, testApp, testAppConfig, testEditions, UK_BUNDLE_ID } from '../test-support';

const MINUTE = 60 * 1000;

/** An email no other test uses, so the tests share the run's database safely. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** A private relay address, as Apple gives SLOVO for a reader who hides their email. */
const newRelayEmail = () => `${randomUUID().slice(0, 12)}@privaterelay.appleid.com`;

/** The backend, and the ways of signing an email in: with Apple, with Google, or with a Sign-in code. */
function signingIn() {
  const backend = testApp();
  const { client, clientOf, apple, google, mailer } = backend;
  const appleToken = async (email: string) =>
    (await client.account.signInWithApple({ idToken: apple.token({ email }), editionId: 'uk' }))
      .token;
  const googleToken = async (email: string) =>
    (await client.account.signInWithGoogle({ idToken: google.token({ email }), editionId: 'uk' }))
      .token;
  async function codeToken(email: string) {
    await client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    return token;
  }
  return {
    ...backend,
    /** The Account procedures of a device signed in to the email's Account with Apple. */
    signInWithApple: async (email: string) => clientOf(await appleToken(email)).account,
    /** The Account procedures of a device signed in to the email's Account with Google. */
    signInWithGoogle: async (email: string) => clientOf(await googleToken(email)).account,
    /** The Account procedures of a device signed in to the email's Account with a Sign-in code. */
    signInWithCode: async (email: string) => clientOf(await codeToken(email)).account,
  };
}

describe('signing in with an Apple identity token', () => {
  it('creates the Account and a Session with the first token for an email, and me answers its email', async () => {
    const { client, clientOf, apple, rowsOf } = signingIn();
    const email = newEmail();
    const before = Date.now();

    const session = await client.account.signInWithApple({
      idToken: apple.token({ email }),
      editionId: 'uk',
    });

    expect(session).toEqual({ token: expect.any(String) as unknown, email });
    const me = await clientOf(session.token).account.me();
    expect(me).toEqual({ email, createdAt: expect.any(String) as unknown });
    expect(Date.parse(me.createdAt)).toBeGreaterThanOrEqual(before - 1000);
    const rows = await rowsOf(email);
    expect(rows.sessions).toHaveLength(1);
    expect(rows.signInMethods).toMatchObject([{ providerId: 'apple' }]);
  });

  it('creates the Account for a private relay address, as for any email', async () => {
    const { client, clientOf, apple, rowsOf } = signingIn();
    const email = newRelayEmail();

    const session = await client.account.signInWithApple({
      idToken: apple.token({ email }),
      editionId: 'uk',
    });

    expect(session.email).toBe(email);
    await expect(clientOf(session.token).account.me()).resolves.toMatchObject({ email });
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      signInMethods: [{ providerId: 'apple' }],
    });
  });

  it('keeps the email as the Account keeps it, whatever its capitals', async () => {
    const { client, apple } = signingIn();
    const email = newEmail();

    const session = await client.account.signInWithApple({
      idToken: apple.token({ email: email.replace('reader', 'READER') }),
      editionId: 'uk',
    });

    expect(session.email).toBe(email);
  });
});

describe('one email reaches one Account (ADR 0047)', () => {
  it('with Apple after a Sign-in code made it: the same Account, with Apple recorded', async () => {
    const { signInWithApple, signInWithCode, rowsOf } = signingIn();
    const email = newEmail();
    const codeMade = await (await signInWithCode(email)).me();

    const byApple = await signInWithApple(email);

    await expect(byApple.me()).resolves.toEqual(codeMade);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'apple' }],
    });
  });

  it('with a Sign-in code after Apple made it: the same Account, and the code adds no method', async () => {
    const { signInWithApple, signInWithCode, rowsOf } = signingIn();
    const email = newEmail();
    const appleMade = await (await signInWithApple(email)).me();

    const byCode = await signInWithCode(email);

    await expect(byCode.me()).resolves.toEqual(appleMade);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'apple' }],
    });
  });

  it('with Google after Apple made it: the same Account, each method recorded once', async () => {
    const { signInWithApple, signInWithGoogle, rowsOf } = signingIn();
    const email = newEmail();
    const appleMade = await (await signInWithApple(email)).me();

    const byGoogle = await signInWithGoogle(email);
    const byAppleAgain = await signInWithApple(email);

    await expect(byGoogle.me()).resolves.toEqual(appleMade);
    await expect(byAppleAgain.me()).resolves.toEqual(appleMade);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}, {}],
      signInMethods: [{ providerId: 'apple' }, { providerId: 'google' }],
    });
  });
});

describe('an Apple identity token', () => {
  /** The refusal a token gets, and that no Account comes of it. */
  async function refusalOf(idToken: string, backend = signingIn(), email?: string) {
    const refused = await backend.client.account.signInWithApple({ idToken, editionId: 'uk' }).then(
      () => undefined,
      (error: unknown) => error,
    );
    if (email !== undefined) expect((await backend.rowsOf(email)).account).toBeUndefined();
    return refused;
  }

  it('that is not a token at all is INVALID_TOKEN', async () => {
    expect(await refusalOf('not-a-token')).toMatchObject({
      code: 'INVALID_TOKEN',
      status: 401,
      defined: true,
    });
  });

  it('that Apple did not sign is INVALID_TOKEN, and makes no Account', async () => {
    const backend = signingIn();
    const email = newEmail();
    const forged = backend.apple.token({ email }, { signed: false });

    expect(await refusalOf(forged, backend, email)).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('from another issuer is INVALID_TOKEN, and makes no Account', async () => {
    const backend = signingIn();
    const email = newEmail();
    const foreign = backend.apple.token({ email }, { issuer: 'https://accounts.google.com' });

    expect(await refusalOf(foreign, backend, email)).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('signs in until it runs out, and is INVALID_TOKEN after', async () => {
    const backend = signingIn();
    const email = newEmail();
    const idToken = backend.apple.token({ email });
    passTime(9 * MINUTE);
    await expect(
      backend.client.account.signInWithApple({ idToken, editionId: 'uk' }),
    ).resolves.toMatchObject({ email });

    passTime(MINUTE);

    expect(await refusalOf(idToken, backend)).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it("for another app than the Edition's is FOREIGN_AUDIENCE, and makes no Account", async () => {
    const backend = signingIn();
    const email = newEmail();
    const foreign = backend.apple.token({ email }, { audience: 'app.slovo.another' });

    expect(await refusalOf(foreign, backend, email)).toMatchObject({
      code: 'FOREIGN_AUDIENCE',
      status: 401,
      defined: true,
    });
  });

  it("is checked against the app's bundle id from the AppConfig", async () => {
    const backend = testApp({ app: { ...testAppConfig, bundleId: 'app.slovo.other' } });
    const email = newEmail();

    await expect(
      backend.client.account.signInWithApple({
        idToken: backend.apple.token({ email }, { audience: UK_BUNDLE_ID }),
        editionId: 'uk',
      }),
    ).rejects.toMatchObject({ code: 'FOREIGN_AUDIENCE' });
    await expect(
      backend.client.account.signInWithApple({
        idToken: backend.apple.token({ email }, { audience: 'app.slovo.other' }),
        editionId: 'uk',
      }),
    ).resolves.toMatchObject({ email });
  });

  it('that is empty or too long is BAD_REQUEST', async () => {
    const { request } = signingIn();
    const post = (idToken: string) =>
      request('/v1/account/apple-sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken, editionId: 'uk' }),
      });

    expect((await post('')).status).toBe(400);
    expect((await post('x'.repeat(4097))).status).toBe(400);
  });
});

describe('an Edition', () => {
  it('the backend did not find is NOT_FOUND', async () => {
    const { client, apple } = testApp();

    await expect(
      client.account.signInWithApple({
        idToken: apple.token({ email: newEmail() }),
        editionId: 'xx',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('with Sign in with Apple switched off is NOT_FOUND, while a Sign-in code still works', async () => {
    const folder = testEditions(['uk'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, signInWithApple: false },
    }));
    const { client, apple, mailer, rowsOf } = testApp({ editions: folder.read() });
    const email = newEmail();

    await expect(
      client.account.signInWithApple({ idToken: apple.token({ email }), editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect((await rowsOf(email)).account).toBeUndefined();

    await client.account.requestCode({ email, editionId: 'uk' });
    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });

  it('with Sign in with Apple turned off remotely is NOT_FOUND until the switch is cleared', async () => {
    const { client, apple, switchOff, clearSwitch } = testApp();
    const email = newEmail();
    const signIn = () =>
      client.account.signInWithApple({ idToken: apple.token({ email }), editionId: 'uk' });
    await switchOff('uk', 'signInWithApple');

    await expect(signIn()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    await clearSwitch('uk', 'signInWithApple');
    await expect(signIn()).resolves.toMatchObject({ email });
  });
});

describe('an Account Apple made', () => {
  it('signs out, signs out everywhere and is deleted like one a Sign-in code made', async () => {
    const { signInWithApple, rowsOf } = signingIn();
    const email = newEmail();
    const phone = await signInWithApple(email);
    const tablet = await signInWithApple(email);
    const unauthorized = { code: 'UNAUTHORIZED', status: 401 };

    await expect(phone.signOut()).resolves.toEqual({});
    await expect(phone.me()).rejects.toMatchObject(unauthorized);
    await expect(tablet.me()).resolves.toMatchObject({ email });

    await expect(tablet.signOutEverywhere()).resolves.toEqual({});
    await expect(tablet.me()).rejects.toMatchObject(unauthorized);

    const again = await signInWithApple(email);
    expect((await rowsOf(email)).account).toBeDefined();
    await expect(again.delete()).resolves.toEqual({});

    expect(await rowsOf(email)).toMatchObject({ accountRows: 0, sessions: [], signInMethods: [] });
    await expect(again.me()).rejects.toMatchObject(unauthorized);
  });
});
