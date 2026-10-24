import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accounts, sessions, signInMethods } from '../database/schema';
import { passTime, testApp, testEditions } from '../test-support';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** An email no other test uses, so the tests share the run's database safely. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** The backend, and the ways of signing an email in: with Google, or with a Sign-in code. */
function signingIn() {
  const backend = testApp();
  const { client, clientOf, google, mailer } = backend;
  /** The Session's token from a Google sign-in of the email. */
  const googleToken = async (email: string) =>
    (await client.account.signInWithGoogle({ idToken: google.token({ email }), editionId: 'uk' }))
      .token;
  /** The Session's token from a Sign-in code sent to the email. */
  async function codeToken(email: string) {
    await client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    return token;
  }
  /** What the database keeps of the email's Account, and how many Accounts it keeps for the email. */
  async function rowsOf(email: string) {
    const { db } = backend.database;
    const found = await db.select().from(accounts).where(eq(accounts.email, email));
    const [account] = found;
    const ofAccount = async (table: typeof sessions | typeof signInMethods) =>
      account === undefined ? [] : db.select().from(table).where(eq(table.accountId, account.id));
    return {
      account,
      accountRows: found.length,
      sessions: await ofAccount(sessions),
      signInMethods: await ofAccount(signInMethods),
      signInCode: await backend.keptSignInCode(email),
    };
  }
  return {
    ...backend,
    /** The Account procedures of a device signed in to the email's Account with Google. */
    signInWithGoogle: async (email: string) => clientOf(await googleToken(email)).account,
    /** The Account procedures of a device signed in to the email's Account with a Sign-in code. */
    signInWithCode: async (email: string) => clientOf(await codeToken(email)).account,
    rowsOf,
  };
}

describe('signing in with a Google identity token', () => {
  it('creates the Account and a Session with the first token for an email, and me answers its email', async () => {
    const { client, clientOf, google, rowsOf } = signingIn();
    const email = newEmail();
    const before = Date.now();

    const session = await client.account.signInWithGoogle({
      idToken: google.token({ email }),
      editionId: 'uk',
    });

    expect(session).toEqual({ token: expect.any(String) as unknown, email });
    const me = await clientOf(session.token).account.me();
    expect(me).toEqual({ email, createdAt: expect.any(String) as unknown });
    expect(Date.parse(me.createdAt)).toBeGreaterThanOrEqual(before - 1000);
    const rows = await rowsOf(email);
    expect(rows.sessions).toHaveLength(1);
    expect(rows.signInMethods).toMatchObject([{ providerId: 'google' }]);
  });

  it('keeps the email as the Account keeps it, whatever its capitals', async () => {
    const { client, google } = signingIn();
    const email = newEmail();

    const session = await client.account.signInWithGoogle({
      idToken: google.token({ email: email.replace('reader', 'READER') }),
      editionId: 'uk',
    });

    expect(session.email).toBe(email);
  });
});

describe('one email reaches one Account (ADR 0047)', () => {
  it('with Google after a Sign-in code made it: the same Account, with Google recorded', async () => {
    const { signInWithGoogle, signInWithCode, rowsOf } = signingIn();
    const email = newEmail();
    const codeMade = await (await signInWithCode(email)).me();

    const byGoogle = await signInWithGoogle(email);

    await expect(byGoogle.me()).resolves.toEqual(codeMade);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'google' }],
    });
  });

  it('with a Sign-in code after Google made it: the same Account, and the code adds no method', async () => {
    const { signInWithGoogle, signInWithCode, rowsOf } = signingIn();
    const email = newEmail();
    const googleMade = await (await signInWithGoogle(email)).me();

    const byCode = await signInWithCode(email);

    await expect(byCode.me()).resolves.toEqual(googleMade);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'google' }],
    });
  });

  it('with Google twice: the same Account, and Google recorded once', async () => {
    const { signInWithGoogle, rowsOf } = signingIn();
    const email = newEmail();
    const first = await (await signInWithGoogle(email)).me();

    const second = await (await signInWithGoogle(email)).me();

    expect(second).toEqual(first);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'google' }],
    });
  });

  it('with Google under another Google identity of the same email: the same Account, each identity recorded', async () => {
    const { client, clientOf, google, signInWithGoogle, rowsOf } = signingIn();
    const email = newEmail();
    const first = await (await signInWithGoogle(email)).me();

    const { token } = await client.account.signInWithGoogle({
      idToken: google.token({ email, subject: 'google-another-identity' }),
      editionId: 'uk',
    });

    await expect(clientOf(token).account.me()).resolves.toEqual(first);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      signInMethods: [{ providerId: 'google' }, { providerId: 'google' }],
    });
  });
});

describe('a Google identity token', () => {
  /** The refusal a token gets, and that no Account comes of it. */
  async function refusalOf(idToken: string, backend = signingIn(), email?: string) {
    const refused = await backend.client.account
      .signInWithGoogle({ idToken, editionId: 'uk' })
      .then(
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

  it('that Google did not sign is INVALID_TOKEN, and makes no Account', async () => {
    const backend = signingIn();
    const email = newEmail();
    const forged = backend.google.token({ email }, { signed: false });

    expect(await refusalOf(forged, backend, email)).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('signs in until it runs out, and is INVALID_TOKEN after', async () => {
    const backend = signingIn();
    const email = newEmail();
    const idToken = backend.google.token({ email });
    passTime(HOUR - MINUTE);
    await expect(
      backend.client.account.signInWithGoogle({ idToken, editionId: 'uk' }),
    ).resolves.toMatchObject({ email });

    passTime(MINUTE);

    expect(await refusalOf(idToken, backend)).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('for another app is FOREIGN_AUDIENCE, and makes no Account', async () => {
    const backend = signingIn();
    const email = newEmail();
    const foreign = backend.google.token({ email }, { audience: 'another-app.example' });

    expect(await refusalOf(foreign, backend, email)).toMatchObject({
      code: 'FOREIGN_AUDIENCE',
      status: 401,
      defined: true,
    });
  });

  it('with an email Google has not verified is EMAIL_NOT_VERIFIED, and makes no Account', async () => {
    const backend = signingIn();
    const email = newEmail();
    const unverified = backend.google.token({ email, emailVerified: false });

    expect(await refusalOf(unverified, backend, email)).toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
      status: 403,
      defined: true,
    });
  });

  it('that is empty or too long is BAD_REQUEST', async () => {
    const { request } = signingIn();
    const post = (idToken: string) =>
      request('/v1/account/google-sessions', {
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
    const { client, google } = testApp();

    await expect(
      client.account.signInWithGoogle({
        idToken: google.token({ email: newEmail() }),
        editionId: 'xx',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('with Google sign-in switched off is NOT_FOUND, while a Sign-in code still works', async () => {
    const folder = testEditions(['uk'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, googleSignIn: false },
    }));
    const { client, google, mailer } = testApp({ editions: folder.read() });
    const email = newEmail();

    await expect(
      client.account.signInWithGoogle({ idToken: google.token({ email }), editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    await client.account.requestCode({ email, editionId: 'uk' });
    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });

  it('with Google sign-in turned off remotely is NOT_FOUND until the switch is cleared', async () => {
    const { client, google, switchOff, clearSwitch } = testApp();
    const email = newEmail();
    const signIn = () =>
      client.account.signInWithGoogle({ idToken: google.token({ email }), editionId: 'uk' });
    await switchOff('uk', 'googleSignIn');

    await expect(signIn()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    await clearSwitch('uk', 'googleSignIn');
    await expect(signIn()).resolves.toMatchObject({ email });
  });
});

describe('a backend with no Google client id', () => {
  it('refuses every token as NOT_FOUND, as with the switch off', async () => {
    const { client, google } = testApp({ googleClientIds: [] });

    await expect(
      client.account.signInWithGoogle({
        idToken: google.token({ email: newEmail() }),
        editionId: 'uk',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('an Account Google made', () => {
  it('signs out, signs out everywhere and is deleted like one a Sign-in code made', async () => {
    const { signInWithGoogle, rowsOf } = signingIn();
    const email = newEmail();
    const phone = await signInWithGoogle(email);
    const tablet = await signInWithGoogle(email);
    const unauthorized = { code: 'UNAUTHORIZED', status: 401 };

    await expect(phone.signOut()).resolves.toEqual({});
    await expect(phone.me()).rejects.toMatchObject(unauthorized);
    await expect(tablet.me()).resolves.toMatchObject({ email });

    await expect(tablet.signOutEverywhere()).resolves.toEqual({});
    await expect(tablet.me()).rejects.toMatchObject(unauthorized);

    const again = await signInWithGoogle(email);
    const { account } = await rowsOf(email);
    await expect(again.delete()).resolves.toEqual({});

    expect(await rowsOf(email)).toMatchObject({ accountRows: 0, sessions: [], signInMethods: [] });
    expect(account).toBeDefined();
    await expect(again.me()).rejects.toMatchObject(unauthorized);
  });

  it('that a Sign-in code also signed in is deleted whole: both methods, every Session and the waiting code', async () => {
    const { client, signInWithGoogle, signInWithCode, rowsOf } = signingIn();
    const email = newEmail();
    const phone = await signInWithGoogle(email);
    const tablet = await signInWithCode(email);
    await client.account.requestCode({ email, editionId: 'uk' });
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'google' }],
      signInCode: {},
    });

    await expect(phone.delete()).resolves.toEqual({});

    expect(await rowsOf(email)).toMatchObject({
      accountRows: 0,
      sessions: [],
      signInMethods: [],
      signInCode: undefined,
    });
    await expect(tablet.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('once deleted lets the same email sign in to a new, empty Account, by Google or by a code', async () => {
    const { signInWithGoogle, signInWithCode, rowsOf } = signingIn();
    const email = newEmail();
    const first = await signInWithGoogle(email);
    const deleted = await rowsOf(email);
    await first.delete();

    passTime(MINUTE);
    const byCode = await (await signInWithCode(email)).me();
    const byGoogle = await (await signInWithGoogle(email)).me();

    expect(byGoogle).toEqual(byCode);
    expect(Date.parse(byCode.createdAt)).toBeGreaterThan(deleted.account?.createdAt.getTime() ?? 0);
    const created = await rowsOf(email);
    expect(created.accountRows).toBe(1);
    expect(created.account?.id).not.toBe(deleted.account?.id);
    expect(created.signInMethods).toHaveLength(1);
  });
});
