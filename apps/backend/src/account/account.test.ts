import { randomUUID } from 'node:crypto';

import { fill } from '@slovo/contracts';
import type { ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accounts, sessions, signInMethods } from '../database/schema';
import { passTime, testApp, testEditions } from '../test-support';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** An email no other test uses, so the tests share the run's database safely. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** Six digits that are not the code. */
const otherThan = (code: string) => (code === '000000' ? '111111' : '000000');

describe('signing in with a Sign-in code', () => {
  it('creates the Account and a Session with the first right code, and me answers its email', async () => {
    const { client, clientOf, mailer } = testApp();
    const email = newEmail();
    const before = Date.now();

    await expect(client.account.requestCode({ email, editionId: 'uk' })).resolves.toEqual({});
    const session = await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });

    expect(session).toEqual({ token: expect.any(String) as unknown, email });
    const me = await clientOf(session.token).account.me();
    expect(me).toEqual({ email, createdAt: expect.any(String) as unknown });
    expect(Date.parse(me.createdAt)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('signs the same Account in again with a later code', async () => {
    const { client, clientOf, mailer } = testApp();
    const email = newEmail();
    const signIn = async () => {
      await client.account.requestCode({ email, editionId: 'uk' });
      const { token } = await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
      return clientOf(token).account.me();
    };

    const first = await signIn();
    const second = await signIn();

    expect(second).toEqual(first);
  });

  it('mails the code in the language of the Edition that asked, from a sender named after it', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    const uk = openEdition(EDITIONS_DIR, 'uk');
    const strings = uk.read('strings').email;

    await client.account.requestCode({ email, editionId: 'uk' });

    const code = mailer.codeSentTo(email);
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(mailer.sent.filter((mail) => mail.to === email)).toEqual([
      {
        to: email,
        senderName: uk.config.displayName,
        subject: fill(strings.subject, { code, name: uk.config.accountName }),
        text: fill(strings.body, { code, name: uk.config.accountName }),
      },
    ]);
  });

  it('answers the same whether or not the email has an Account', async () => {
    const { client, mailer, request } = testApp();
    const known = newEmail();
    await client.account.requestCode({ email: known, editionId: 'uk' });
    await client.account.verifyCode({ email: known, code: mailer.codeSentTo(known) });
    const requestCode = (email: string) =>
      request('/v1/account/sign-in-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, editionId: 'uk' }),
      });

    const forKnown = await requestCode(known);
    const forUnknown = await requestCode(newEmail());

    expect(forUnknown.status).toBe(forKnown.status);
    expect(await forUnknown.text()).toBe(await forKnown.text());
    expect(forKnown.status).toBe(200);
  });

  it('treats an email the same whatever its capitals and the spaces around it', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    const typed = `  ${email.toUpperCase()} `;

    await client.account.requestCode({ email: typed, editionId: 'uk' });
    const session = await client.account.verifyCode({
      email: email.replace('reader', 'READER'),
      code: mailer.codeSentTo(email),
    });

    expect(session.email).toBe(email);
  });

  it('refuses an email that is not an email as BAD_REQUEST and sends nothing', async () => {
    const { client, mailer } = testApp();

    await expect(
      client.account.requestCode({ email: 'not an email', editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    expect(mailer.sent).toEqual([]);
  });
});

describe('a wrong Sign-in code', () => {
  it('signs nothing in and says how many tries are left', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const wrong = otherThan(mailer.codeSentTo(email));

    await expect(client.account.verifyCode({ email, code: wrong })).rejects.toMatchObject({
      code: 'WRONG_CODE',
      status: 400,
      defined: true,
      data: { triesLeft: 4 },
    });
    await expect(client.account.verifyCode({ email, code: wrong })).rejects.toMatchObject({
      code: 'WRONG_CODE',
      data: { triesLeft: 3 },
    });
  });

  it('spends the code after 5 tries, so even the right code is then TOO_MANY_REQUESTS', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const code = mailer.codeSentTo(email);
    for (let tries = 1; tries <= 4; tries++) {
      await expect(
        client.account.verifyCode({ email, code: otherThan(code) }),
      ).rejects.toMatchObject({ code: 'WRONG_CODE', data: { triesLeft: 5 - tries } });
    }

    await expect(client.account.verifyCode({ email, code: otherThan(code) })).rejects.toMatchObject(
      { code: 'TOO_MANY_REQUESTS', status: 429, defined: true },
    );
    for (let more = 0; more < 2; more++) {
      await expect(client.account.verifyCode({ email, code })).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    }
  });

  it('is the old code once a new one is sent, and only the new one signs in', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const old = mailer.codeSentTo(email);
    await client.account.requestCode({ email, editionId: 'uk' });
    const fresh = mailer.codeSentTo(email);
    // Two codes drawn at random may match, once in a million runs.
    if (fresh === old) return;

    await expect(client.account.verifyCode({ email, code: old })).rejects.toMatchObject({
      code: 'WRONG_CODE',
    });
    await expect(client.account.verifyCode({ email, code: fresh })).resolves.toMatchObject({
      email,
    });
  });

  it('opens 5 new tries with a new code', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    for (let tries = 0; tries < 5; tries++) {
      await client.account
        .verifyCode({ email, code: otherThan(mailer.codeSentTo(email)) })
        .catch(() => undefined);
    }

    await client.account.requestCode({ email, editionId: 'uk' });

    await expect(
      client.account.verifyCode({ email, code: otherThan(mailer.codeSentTo(email)) }),
    ).rejects.toMatchObject({ code: 'WRONG_CODE', data: { triesLeft: 4 } });
  });
});

describe('a Sign-in code', () => {
  it('signs in until 10 minutes have passed', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });

    passTime(10 * MINUTE - 1000);

    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });

  it('expires after 10 minutes as CODE_EXPIRED', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });

    passTime(10 * MINUTE + 1000);

    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED', status: 400, defined: true });
  });

  it('is CODE_EXPIRED when none was sent to the email', async () => {
    const { client } = testApp();

    await expect(
      client.account.verifyCode({ email: newEmail(), code: '123456' }),
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
  });

  it('works once: the code that signed in signs nothing in again', async () => {
    const { client, mailer } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const code = mailer.codeSentTo(email);
    await client.account.verifyCode({ email, code });

    await expect(client.account.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
    });
  });

  it('is kept only as its hash', async () => {
    const { client, mailer, keptSignInCode } = testApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });

    const kept = await keptSignInCode(email);

    expect(kept).toEqual({
      id: expect.any(String) as unknown,
      hash: expect.any(String) as unknown,
    });
    expect(JSON.stringify(kept)).not.toContain(mailer.codeSentTo(email));
  });

  it('refuses a code that is not six digits as BAD_REQUEST', async () => {
    const { client } = testApp();

    await expect(
      client.account.verifyCode({ email: newEmail(), code: '12345' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });
});

describe('a Session', () => {
  async function signedIn() {
    const backend = testApp();
    const email = newEmail();
    await backend.client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email,
      code: backend.mailer.codeSentTo(email),
    });
    return { me: () => backend.clientOf(token).account.me(), email };
  }

  it('lasts 90 days after its last use', async () => {
    const { me, email } = await signedIn();

    passTime(89 * DAY);
    await expect(me()).resolves.toMatchObject({ email });
    // 170 days after signing in: more than 90, but fewer since its last use.
    passTime(81 * DAY);
    await expect(me()).resolves.toMatchObject({ email });
    passTime(91 * DAY);
    await expect(me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('an Edition', () => {
  it('the backend did not find is NOT_FOUND, and nothing is sent', async () => {
    const { client, mailer } = testApp();

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'pl' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404, defined: true });
    expect(mailer.sent).toEqual([]);
  });

  it('with the Account switched off is NOT_FOUND, and nothing is sent', async () => {
    const folder = testEditions(['uk'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, account: false },
    }));
    const { client, mailer } = testApp({ editions: folder.read() });

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(mailer.sent).toEqual([]);
  });
});

/** The backend, and a way to sign readers in on it, a new device each time. */
function signingIn() {
  const backend = testApp();
  /** The token of a new Session of the email's Account. */
  async function signInToken(email: string) {
    await backend.client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email,
      code: backend.mailer.codeSentTo(email),
    });
    return token;
  }
  /** The Account procedures of a device signed in to the email's Account. */
  const signIn = async (email: string) => backend.clientOf(await signInToken(email)).account;
  return { ...backend, signIn, signInToken };
}

const unauthorized = { code: 'UNAUTHORIZED', status: 401, defined: true };

/**
 * Each Account procedure that acts on the Account of the request's Session:
 * every one but the four that sign in. The types ask for a new one.
 */
const sessionProcedures: Record<
  Exclude<
    keyof ApiClient['account'],
    'requestCode' | 'verifyCode' | 'signInWithGoogle' | 'signInWithApple'
  >,
  (account: ApiClient['account']) => Promise<unknown>
> = {
  me: (account) => account.me(),
  signOut: (account) => account.signOut(),
  signOutEverywhere: (account) => account.signOutEverywhere(),
  delete: (account) => account.delete(),
};

describe('a procedure of a Session', () => {
  it('is UNAUTHORIZED without a Session, with a token the backend never gave or as the database keeps it, and after the Session ended', async () => {
    const { client, clientOf, signInToken, database } = signingIn();
    const email = newEmail();
    await signInToken(email);
    const [kept] = await database.db
      .select({ token: sessions.token })
      .from(sessions)
      .innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(eq(accounts.email, email));
    const ended = clientOf(await signInToken(newEmail())).account;
    await ended.signOut();
    const devices = {
      'no Session': client.account,
      'a made-up token': clientOf('made-up.token').account,
      'the kept token': clientOf(kept?.token ?? '').account,
      'an ended Session': ended,
    };

    expect(kept).toBeDefined();
    for (const [procedure, run] of Object.entries(sessionProcedures)) {
      for (const [device, account] of Object.entries(devices)) {
        await expect(run(account), `${procedure} with ${device}`).rejects.toMatchObject(
          unauthorized,
        );
      }
    }
  });
});

describe('signing out', () => {
  it('ends this Session, and another Session of the same Account still works', async () => {
    const { signIn } = signingIn();
    const email = newEmail();
    const phone = await signIn(email);
    const tablet = await signIn(email);

    await expect(phone.signOut()).resolves.toEqual({});

    await expect(phone.me()).rejects.toMatchObject(unauthorized);
    await expect(tablet.me()).resolves.toMatchObject({ email });
  });
});

describe('signing out everywhere', () => {
  it('ends every Session of the Account', async () => {
    const { signIn } = signingIn();
    const email = newEmail();
    const phone = await signIn(email);
    const tablet = await signIn(email);

    await expect(phone.signOutEverywhere()).resolves.toEqual({});

    await expect(phone.me()).rejects.toMatchObject(unauthorized);
    await expect(tablet.me()).rejects.toMatchObject(unauthorized);
  });

  it('lets the same email sign in again', async () => {
    const { signIn } = signingIn();
    const email = newEmail();
    await (await signIn(email)).signOutEverywhere();

    await expect((await signIn(email)).me()).resolves.toMatchObject({ email });
  });
});

describe('deleting the Account', () => {
  it('deletes the Account, its Sessions, its sign-in methods and the codes for its email', async () => {
    const { client, clientOf, database, google, signIn, rowsOf } = signingIn();
    const { db } = database;
    const email = newEmail();
    const phone = await signIn(email);
    // A Google sign-in to the same Account records the method (ADR 0047).
    const tablet = clientOf(
      (await client.account.signInWithGoogle({ idToken: google.token({ email }), editionId: 'uk' }))
        .token,
    ).account;
    const id = (await rowsOf(email)).account?.id ?? '';
    // A code waiting for the email when the Account goes.
    await client.account.requestCode({ email, editionId: 'uk' });
    expect(await rowsOf(email)).toMatchObject({
      sessions: [{}, {}],
      signInMethods: [{ providerId: 'google' }],
      signInCode: {},
    });

    await expect(phone.delete()).resolves.toEqual({});

    expect(await rowsOf(email)).toMatchObject({ account: undefined, signInCode: undefined });
    expect(await db.select().from(sessions).where(eq(sessions.accountId, id))).toEqual([]);
    expect(await db.select().from(signInMethods).where(eq(signInMethods.accountId, id))).toEqual(
      [],
    );
    await expect(phone.me()).rejects.toMatchObject(unauthorized);
    await expect(tablet.me()).rejects.toMatchObject(unauthorized);
  });

  it('spends the code that waited for its email', async () => {
    const { client, mailer, signIn } = signingIn();
    const email = newEmail();
    const phone = await signIn(email);
    await client.account.requestCode({ email, editionId: 'uk' });
    const waiting = mailer.codeSentTo(email);

    await phone.delete();

    await expect(client.account.verifyCode({ email, code: waiting })).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
    });
  });

  it('lets the same email sign in to a new, empty Account', async () => {
    const { signIn, rowsOf } = signingIn();
    const email = newEmail();
    const first = await signIn(email);
    const deleted = await rowsOf(email);
    await first.delete();

    passTime(MINUTE);
    const again = await signIn(email);

    const me = await again.me();
    expect(me.email).toBe(email);
    expect(Date.parse(me.createdAt)).toBeGreaterThan(deleted.account?.createdAt.getTime() ?? 0);
    const created = await rowsOf(email);
    expect(created.account?.id).not.toBe(deleted.account?.id);
    expect(created.sessions).toHaveLength(1);
    expect(created.signInMethods).toEqual([]);
  });
});

describe('one Account', () => {
  it('signs out only its own Sessions, everywhere included', async () => {
    const { signIn } = signingIn();
    const other = newEmail();
    const email = newEmail();
    const phone = await signIn(email);
    const tablet = await signIn(email);
    const otherReader = await signIn(other);

    await phone.signOut();
    await tablet.signOutEverywhere();

    await expect(otherReader.me()).resolves.toMatchObject({ email: other });
  });

  it('deletes only itself', async () => {
    const { signIn, rowsOf } = signingIn();
    const other = newEmail();
    const reader = await signIn(newEmail());
    const otherReader = await signIn(other);
    const before = await rowsOf(other);

    await reader.delete();

    await expect(otherReader.me()).resolves.toMatchObject({ email: other });
    expect(await rowsOf(other)).toEqual(before);
  });

  it('refuses a request that names another Account as BAD_REQUEST', async () => {
    const { request, signIn, signInToken, rowsOf } = signingIn();
    const email = newEmail();
    const other = newEmail();
    const token = await signInToken(email);
    const otherReader = await signIn(other);
    const before = await rowsOf(other);
    const send = (method: string, path: string) =>
      request(path, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ accountId: before.account?.id, email: other }),
      });

    for (const path of ['/v1/account/sessions/current', '/v1/account/sessions', '/v1/account/me']) {
      expect((await send('DELETE', path)).status).toBe(400);
    }

    await expect(otherReader.me()).resolves.toMatchObject({ email: other });
    expect(await rowsOf(other)).toEqual(before);
    await expect(
      request('/v1/account/me', { headers: { authorization: `Bearer ${token}` } }),
    ).resolves.toMatchObject({ status: 200 });
  });
});
