import { randomUUID } from 'node:crypto';

import { ACCOUNT_NAME, fill } from '@slovo/contracts';
import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';
import { eq } from 'drizzle-orm';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { accounts, sessions, signInCodes, signInMethods } from '../database/schema';
import { readEditions } from '../edition/edition-folders';
import { connectionFrom, createFakeMailer, editionsFolder, testApp } from '../test-support';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** An email no other test uses, so the tests share the run's database safely. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** Six digits that are not the code. */
const otherThan = (code: string) => (code === '000000' ? '111111' : '000000');

/** The backend with a fake Mailer the test reads the Sign-in codes from. */
function accountApp() {
  const mailer = createFakeMailer();
  const backend = testApp({ mailer });
  onTestFinished(backend.close);
  return { ...backend, mailer };
}

/** Lets the test move the clock that better-auth reads; timers stay real. */
function movableClock() {
  vi.useFakeTimers({ toFake: ['Date'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const start = Date.now();
  return { at: (ms: number) => vi.setSystemTime(start + ms) };
}

describe('signing in with a Sign-in code', () => {
  it('creates the Account and a Session with the first right code, and me answers its email', async () => {
    const { client, clientOf, mailer } = accountApp();
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
    const { client, clientOf, mailer } = accountApp();
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
    const { client, mailer } = accountApp();
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
        subject: fill(strings.subject, { code, name: ACCOUNT_NAME }),
        text: fill(strings.body, { code, name: ACCOUNT_NAME }),
      },
    ]);
  });

  it('answers the same whether or not the email has an Account', async () => {
    const { app, client, mailer, ip } = accountApp();
    const known = newEmail();
    await client.account.requestCode({ email: known, editionId: 'uk' });
    await client.account.verifyCode({ email: known, code: mailer.codeSentTo(known) });
    const request = (email: string) =>
      app.request(
        '/v1/account/sign-in-codes',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, editionId: 'uk' }),
        },
        connectionFrom(ip),
      );

    const forKnown = await request(known);
    const forUnknown = await request(newEmail());

    expect(forUnknown.status).toBe(forKnown.status);
    expect(await forUnknown.text()).toBe(await forKnown.text());
    expect(forKnown.status).toBe(200);
  });

  it('treats an email the same whatever its capitals and the spaces around it', async () => {
    const { client, mailer } = accountApp();
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
    const { client, mailer } = accountApp();

    await expect(
      client.account.requestCode({ email: 'not an email', editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    expect(mailer.sent).toEqual([]);
  });
});

describe('a wrong Sign-in code', () => {
  it('signs nothing in and says how many tries are left', async () => {
    const { client, mailer } = accountApp();
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
    const { client, mailer } = accountApp();
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
    const { client, mailer } = accountApp();
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
    const { client, mailer } = accountApp();
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
    const clock = movableClock();
    const { client, mailer } = accountApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });

    clock.at(10 * MINUTE - 1000);

    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });

  it('expires after 10 minutes as CODE_EXPIRED', async () => {
    const clock = movableClock();
    const { client, mailer } = accountApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });

    clock.at(10 * MINUTE + 1000);

    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED', status: 400, defined: true });
  });

  it('is CODE_EXPIRED when none was sent to the email', async () => {
    const { client } = accountApp();

    await expect(
      client.account.verifyCode({ email: newEmail(), code: '123456' }),
    ).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
  });

  it('works once: the code that signed in signs nothing in again', async () => {
    const { client, mailer } = accountApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const code = mailer.codeSentTo(email);
    await client.account.verifyCode({ email, code });

    await expect(client.account.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
    });
  });

  it('is kept only as its hash', async () => {
    const { client, mailer, database } = accountApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const { db } = database;

    const kept = (await db.select().from(signInCodes)).filter((row) =>
      row.identifier.endsWith(email),
    );

    expect(kept).toHaveLength(1);
    expect(JSON.stringify(kept)).not.toContain(mailer.codeSentTo(email));
  });

  it('refuses a code that is not six digits as BAD_REQUEST', async () => {
    const { client } = accountApp();

    await expect(
      client.account.verifyCode({ email: newEmail(), code: '12345' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });
});

describe('a Session', () => {
  async function signedIn() {
    const backend = accountApp();
    const email = newEmail();
    await backend.client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email,
      code: backend.mailer.codeSentTo(email),
    });
    return { me: () => backend.clientOf(token).account.me(), email };
  }

  it('is needed for me: without one it is UNAUTHORIZED', async () => {
    const { client } = accountApp();

    await expect(client.account.me()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
      defined: true,
    });
  });

  it('is UNAUTHORIZED with a token the backend never gave', async () => {
    const { clientOf } = accountApp();

    await expect(clientOf('made-up.token').account.me()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });

  it('is not signed in by the token as the database keeps it', async () => {
    const { client, clientOf, mailer, database } = accountApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    const { db } = database;

    const [kept] = await db
      .select({ token: sessions.token })
      .from(sessions)
      .innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(eq(accounts.email, email));

    expect(kept).toBeDefined();
    await expect(clientOf(kept?.token ?? '').account.me()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('lasts 90 days after its last use', async () => {
    const clock = movableClock();
    const { me, email } = await signedIn();

    clock.at(89 * DAY);
    await expect(me()).resolves.toMatchObject({ email });
    // More than 90 days after signing in, but fewer after its last use.
    clock.at(170 * DAY);
    await expect(me()).resolves.toMatchObject({ email });
    clock.at(170 * DAY + 91 * DAY);
    await expect(me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('an Edition', () => {
  it('the backend did not find is NOT_FOUND, and nothing is sent', async () => {
    const { client, mailer } = accountApp();

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'pl' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404, defined: true });
    expect(mailer.sent).toEqual([]);
  });

  it('with the Account switched off is NOT_FOUND, and nothing is sent', async () => {
    const mailer = createFakeMailer();
    const folder = editionsFolder(['uk'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, account: false },
    }));
    const { client, close } = testApp({ mailer, editions: readEditions(folder) });
    onTestFinished(close);

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(mailer.sent).toEqual([]);
  });
});

/** The backend, and a way to sign readers in on it, a new device each time. */
function signingIn() {
  const backend = accountApp();
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
  /** The rows the database keeps of the email's Account. */
  async function rowsOf(email: string) {
    const { db } = backend.database;
    const [account] = await db.select().from(accounts).where(eq(accounts.email, email));
    const ofAccount = async (table: typeof sessions | typeof signInMethods) =>
      account === undefined ? [] : db.select().from(table).where(eq(table.accountId, account.id));
    return {
      account,
      sessions: await ofAccount(sessions),
      signInMethods: await ofAccount(signInMethods),
      signInCodes: (await db.select().from(signInCodes)).filter((row) =>
        row.identifier.endsWith(email),
      ),
    };
  }
  return { ...backend, signIn, signInToken, rowsOf };
}

const unauthorized = { code: 'UNAUTHORIZED', status: 401, defined: true };

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

  it('is UNAUTHORIZED without a Session, or with one that has ended', async () => {
    const { client, signIn } = signingIn();
    const phone = await signIn(newEmail());
    await phone.signOut();

    await expect(client.account.signOut()).rejects.toMatchObject(unauthorized);
    await expect(phone.signOut()).rejects.toMatchObject(unauthorized);
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

  it('is UNAUTHORIZED without a Session', async () => {
    const { client } = signingIn();

    await expect(client.account.signOutEverywhere()).rejects.toMatchObject(unauthorized);
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
    const { client, database, signIn, rowsOf } = signingIn();
    const { db } = database;
    const email = newEmail();
    const phone = await signIn(email);
    const tablet = await signIn(email);
    const id = (await rowsOf(email)).account?.id ?? '';
    // Sign in with Apple and Google arrive in 0.9; this row stands for one.
    const now = new Date();
    await db.insert(signInMethods).values({
      accountId: id,
      providerId: 'apple',
      providerAccountId: 'apple-id',
      createdAt: now,
      updatedAt: now,
    });
    // A code waiting for the email when the Account goes.
    await client.account.requestCode({ email, editionId: 'uk' });
    expect(await rowsOf(email)).toMatchObject({
      sessions: [{}, {}],
      signInMethods: [{}],
      signInCodes: [{}],
    });

    await expect(phone.delete()).resolves.toEqual({});

    expect(await rowsOf(email)).toMatchObject({ account: undefined, signInCodes: [] });
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
    const clock = movableClock();
    const { signIn, rowsOf } = signingIn();
    const email = newEmail();
    const first = await signIn(email);
    const deleted = await rowsOf(email);
    await first.delete();

    clock.at(MINUTE);
    const again = await signIn(email);

    const me = await again.me();
    expect(me.email).toBe(email);
    expect(Date.parse(me.createdAt)).toBeGreaterThan(deleted.account?.createdAt.getTime() ?? 0);
    const created = await rowsOf(email);
    expect(created.account?.id).not.toBe(deleted.account?.id);
    expect(created.sessions).toHaveLength(1);
    expect(created.signInMethods).toEqual([]);
  });

  it('is UNAUTHORIZED without a Session', async () => {
    const { client } = signingIn();

    await expect(client.account.delete()).rejects.toMatchObject(unauthorized);
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
    const { app, signIn, signInToken, rowsOf } = signingIn();
    const email = newEmail();
    const other = newEmail();
    const token = await signInToken(email);
    const otherReader = await signIn(other);
    const before = await rowsOf(other);
    const send = (method: string, path: string) =>
      app.request(path, {
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
      app.request('/v1/account/me', { headers: { authorization: `Bearer ${token}` } }),
    ).resolves.toMatchObject({ status: 200 });
  });
});
