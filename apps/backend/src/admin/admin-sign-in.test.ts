import { randomUUID } from 'node:crypto';

import { createAdminAccess, systemClock, totpOf } from '@slovo/server-core';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { eq } from 'drizzle-orm';

import { adminUsers } from '../database/schema';
import { systemRandom } from '../random';
import { adminCommandDeps, adminHeaders, passTime, signedInAdmin, testApp } from '../test-support';
import { runAdminCommand } from './admin-command';
import { createAdminStore, createSecretVault, hashToken, hmacSha1 } from './admin-store';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The backend, a Власник in its database: the admin is on. */
async function adminOn() {
  const backend = testApp();
  const owner = await signedInAdmin(backend, 'owner');
  const anonymous = backend.clientWith(adminHeaders());
  return { ...backend, owner, anonymous };
}

/** Signs in again, past the set-up: the emailed code and a TOTP or a recovery code. */
async function signInAgain(
  backend: Awaited<ReturnType<typeof adminOn>>,
  email: string,
  factor: { kind: 'totp'; totp: string } | { kind: 'recovery'; recoveryCode: string },
) {
  await backend.anonymous.admin.requestCode({ email });
  const code = backend.mailer.codeSentTo(email);
  await expect(backend.anonymous.admin.verifyCode({ email, code })).resolves.toEqual({
    next: 'totp',
  });
  return backend.request('/v1/admin/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ email, code, factor }),
  });
}

describe('the admin sign-in', () => {
  it('sets up a TOTP on the first sign-in and sets a strict cookie on the admin API only', async () => {
    const backend = await adminOn();
    const { email, enrolment, cookie, client } = await signedInAdmin(backend, 'admin');

    expect(enrolment.otpauthUrl).toContain(`secret=${enrolment.secret}`);
    expect(enrolment.recoveryCodes).toHaveLength(10);
    expect(new Set(enrolment.recoveryCodes).size).toBe(10);
    await expect(client.admin.me()).resolves.toEqual({ email, role: 'admin' });

    const again = await signInAgain(backend, email, {
      kind: 'totp',
      // The next step: the set-up spent this one.
      totp: totpOf(hmacSha1, enrolment.secret, new Date(Date.now() + 30_000)),
    });
    expect(again.status).toBe(200);
    const set = again.headers.get('set-cookie') ?? '';
    expect(set).toContain('Path=/v1/admin;');
    expect(set).toContain('HttpOnly');
    expect(set).toContain('Secure');
    expect(set).toContain('SameSite=Strict');
    expect(cookie).toMatch(/^slovo_admin_session=.+/);
  });

  it('answers an Admin user the same when the code email fails, and logs the failure', async () => {
    const lines: string[] = [];
    const logger = pino({ level: 'error' }, { write: (line: string) => lines.push(line) });
    const backend = testApp({ logger });
    const { email } = await signedInAdmin(backend, 'owner');
    backend.mailer.failNext();

    await expect(backend.clientWith(adminHeaders()).admin.requestCode({ email })).resolves.toEqual({
      sent: true,
    });
    await vi.waitFor(() => {
      expect(lines.join('')).toContain('admin sign-in code not sent');
    });
    expect(lines.join('')).not.toContain(email);
  });

  it('answers the same for an email with no Admin user, and sends it nothing', async () => {
    const backend = await adminOn();
    const sent = backend.mailer.sent.length;

    await expect(
      backend.anonymous.admin.requestCode({ email: 'stranger@example.com' }),
    ).resolves.toEqual({ sent: true });
    expect(backend.mailer.sent).toHaveLength(sent);
  });

  it('takes a recovery code once in place of the TOTP', async () => {
    const backend = await adminOn();
    const { email, enrolment } = await signedInAdmin(backend, 'admin');
    const [recoveryCode] = enrolment.recoveryCodes;
    if (recoveryCode === undefined) throw new Error('no recovery code shown');

    expect((await signInAgain(backend, email, { kind: 'recovery', recoveryCode })).status).toBe(
      200,
    );
    expect((await signInAgain(backend, email, { kind: 'recovery', recoveryCode })).status).toBe(
      401,
    );
  });

  it('refuses a TOTP no newer than the last one it took', async () => {
    const backend = await adminOn();
    const { email, enrolment } = await signedInAdmin(backend, 'admin');
    // One step back: in the window, and at or before the step the set-up took.
    const totp = totpOf(hmacSha1, enrolment.secret, new Date(Date.now() - 30_000));

    expect((await signInAgain(backend, email, { kind: 'totp', totp })).status).toBe(401);
  });

  it('refuses a code 10 minutes old', async () => {
    const backend = await adminOn();
    const { email } = await signedInAdmin(backend, 'admin');
    await backend.anonymous.admin.requestCode({ email });
    const code = backend.mailer.codeSentTo(email);

    passTime(10 * MINUTE + 1000);

    await expect(backend.anonymous.admin.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('blocks the email for 15 minutes after three failed TOTPs', async () => {
    const backend = await adminOn();
    const { email, enrolment } = await signedInAdmin(backend, 'admin');
    // Not six digits: no TOTP is ever this.
    const wrong = { kind: 'totp', totp: 'wrong!' } as const;

    const statuses = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      statuses.push((await signInAgain(backend, email, wrong)).status);
    }
    // The third failure is the one that blocks.
    expect(statuses).toEqual([401, 401, 429]);
    await backend.anonymous.admin.requestCode({ email });
    const code = backend.mailer.codeSentTo(email);
    await expect(backend.anonymous.admin.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    passTime(15 * MINUTE + 1000);

    const right = { kind: 'totp', totp: totpOf(hmacSha1, enrolment.secret, new Date()) } as const;
    expect((await signInAgain(backend, email, right)).status).toBe(200);
  });

  it('checks at most three codes of an email, however many come together', async () => {
    const backend = await adminOn();
    const email = `fresh-${randomUUID()}@example.com`;
    await createAdminStore(backend.database).addAdminUser({
      email,
      role: 'owner',
      createdAt: new Date(),
    });
    await backend.anonymous.admin.requestCode({ email });
    const code = backend.mailer.codeSentTo(email);
    const guesses = Array.from({ length: 12 }, (_, guess) =>
      String((Number(code) + 1 + guess) % 1_000_000).padStart(6, '0'),
    );

    // Requests that come together are taken in no set order, so a right code
    // among them could be one of the three checked: it comes after them.
    const answers = await Promise.allSettled(
      guesses.map((guess) => backend.anonymous.admin.verifyCode({ email, code: guess })),
    );

    expect(answers.filter((answer) => answer.status === 'fulfilled')).toEqual([]);
    await expect(backend.anonymous.admin.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('sends an email at most ten sign-in codes an hour, and answers the same past that', async () => {
    const backend = await adminOn();
    const email = `fresh-${randomUUID()}@example.com`;
    await createAdminStore(backend.database).addAdminUser({
      email,
      role: 'admin',
      createdAt: new Date(),
    });
    const sent = () => backend.mailer.sent.filter((mail) => mail.to === email).length;

    for (let request = 0; request < 11; request++) {
      await expect(backend.anonymous.admin.requestCode({ email })).resolves.toEqual({ sent: true });
    }
    expect(sent()).toBe(10);

    passTime(HOUR + 1000);
    await backend.anonymous.admin.requestCode({ email });
    expect(sent()).toBe(11);
  });

  it('sends no sign-in code to a request from an IP address past 20 in 10 minutes', async () => {
    const backend = await adminOn();
    const { email } = backend.owner;
    const sent = () => backend.mailer.sent.filter((mail) => mail.to === email).length;
    const before = sent();
    for (let stranger = 0; stranger < 20; stranger++) {
      await backend.anonymous.admin.requestCode({
        email: `stranger-${String(stranger)}@example.com`,
      });
    }

    await expect(backend.anonymous.admin.requestCode({ email })).resolves.toEqual({ sent: true });
    expect(sent()).toBe(before);
  });

  it('answers the TOTP set-up it showed again to a repeated request, which then signs in', async () => {
    const backend = await adminOn();
    const email = `admin-${randomUUID()}@example.com`;
    await createAdminStore(backend.database).addAdminUser({
      email,
      role: 'admin',
      createdAt: new Date(),
    });
    await backend.anonymous.admin.requestCode({ email });
    const code = backend.mailer.codeSentTo(email);
    const verify = () => backend.anonymous.admin.verifyCode({ email, code });

    const together = await Promise.all([verify(), verify()]);
    const again = await verify();

    expect(together[0]).toMatchObject({ next: 'enrol' });
    expect(together[1]).toEqual(together[0]);
    expect(again).toEqual(together[0]);
    if (again.next !== 'enrol') throw new Error('no TOTP set-up shown');
    const [recoveryCode] = again.recoveryCodes;
    if (recoveryCode === undefined) throw new Error('no recovery code shown');
    const signIn = await backend.request('/v1/admin/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({
        email,
        code,
        factor: { kind: 'totp', totp: totpOf(hmacSha1, again.secret, new Date()) },
      }),
    });
    expect(signIn.status).toBe(200);
    expect((await signInAgain(backend, email, { kind: 'recovery', recoveryCode })).status).toBe(
      200,
    );
  });

  it('refuses a sign-in whose TOTP the vault no longer opens, until a server command resets it', async () => {
    const backend = await adminOn();
    const { email, enrolment } = await signedInAdmin(backend, 'admin');
    const [recoveryCode] = enrolment.recoveryCodes;
    if (recoveryCode === undefined) throw new Error('no recovery code shown');
    // The TOTP as sealed under another `AUTH_SECRET`: rotated, or another Deployment's.
    await backend.database.db
      .update(adminUsers)
      .set({ totpSecret: createSecretVault('the secret before').seal(enrolment.secret) })
      .where(eq(adminUsers.email, email));
    await backend.anonymous.admin.requestCode({ email });
    const code = backend.mailer.codeSentTo(email);
    const signInWith = (factor: object) =>
      backend.request('/v1/admin/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ email, code, factor }),
      });

    // The emailed code alone never sets up a new TOTP in place of one that is on.
    await expect(backend.anonymous.admin.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const totp = totpOf(hmacSha1, enrolment.secret, new Date(Date.now() + 30_000));
    expect((await signInWith({ kind: 'totp', totp })).status).toBe(409);
    expect((await signInWith({ kind: 'recovery', recoveryCode })).status).toBe(409);

    const admin = createAdminAccess({
      store: createAdminStore(backend.database),
      clock: systemClock,
      random: systemRandom,
      hash: hashToken,
    });
    const out: string[] = [];
    const reset = await runAdminCommand(
      ['totp', 'reset', email.toUpperCase()],
      adminCommandDeps(admin, backend.database),
      { out: (line) => out.push(line), err: (line) => out.push(line) },
    );

    expect(reset).toBe(0);
    expect(await admin.actions()).toContainEqual(
      expect.objectContaining({
        who: { kind: 'command', command: 'pnpm admin totp reset' },
        what: 'admin.user.totp-reset',
        before: { email, role: 'admin' },
      }),
    );
    const set = await backend.anonymous.admin.verifyCode({ email, code });
    if (set.next !== 'enrol') throw new Error('no TOTP set-up shown');
    expect(set.secret).not.toBe(enrolment.secret);
    expect(
      (await signInWith({ kind: 'totp', totp: totpOf(hmacSha1, set.secret, new Date()) })).status,
    ).toBe(200);
  });

  it('resets the TOTP only of an active Admin user', async () => {
    const backend = await adminOn();
    const admin = createAdminAccess({
      store: createAdminStore(backend.database),
      clock: systemClock,
      random: systemRandom,
      hash: hashToken,
    });
    const err: string[] = [];

    const reset = await runAdminCommand(
      ['totp', 'reset', `nobody-${randomUUID()}@example.com`],
      adminCommandDeps(admin, backend.database),
      { out: () => undefined, err: (line) => err.push(line) },
    );

    expect(reset).toBe(1);
    expect(err).toHaveLength(1);
  });

  it('refuses a write without the admin header', async () => {
    const backend = await adminOn();
    const bare = backend.clientWith({});

    await expect(bare.admin.requestCode({ email: backend.owner.email })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('an admin session', () => {
  it('ends after 8 idle hours', async () => {
    const backend = await adminOn();
    const { client } = await signedInAdmin(backend, 'admin');

    passTime(7 * HOUR);
    await expect(client.admin.me()).resolves.toMatchObject({ role: 'admin' });
    passTime(8 * HOUR + 1000);

    await expect(client.admin.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('ends 30 days after it began, used or not', async () => {
    const backend = await adminOn();
    const { client } = await signedInAdmin(backend, 'admin');

    // Used every 7 hours, never idle for 8.
    for (let used = 0; used + 7 * HOUR < 30 * DAY; used += 7 * HOUR) {
      await expect(client.admin.me()).resolves.toMatchObject({ role: 'admin' });
      passTime(7 * HOUR);
    }
    passTime(7 * HOUR);

    await expect(client.admin.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('lists in «Мої сесії», and «Вийти всюди» ends the Admin user’s sessions only', async () => {
    const backend = await adminOn();
    const first = await signedInAdmin(backend, 'admin');
    const second = await signInAgain(backend, first.email, {
      kind: 'totp',
      // The next step: the set-up spent this one.
      totp: totpOf(hmacSha1, first.enrolment.secret, new Date(Date.now() + 30_000)),
    });
    const other = backend.clientWith(
      adminHeaders((second.headers.get('set-cookie') ?? '').split(';')[0]),
    );

    const { sessions } = await first.client.admin.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);

    await expect(other.admin.signOutEverywhere()).resolves.toEqual({ signedOut: true });

    await expect(first.client.admin.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(other.admin.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(backend.owner.client.admin.me()).resolves.toMatchObject({ role: 'owner' });
  });

  it('ends on sign-out, which clears the cookie', async () => {
    const backend = await adminOn();
    const { cookie, client } = await signedInAdmin(backend, 'admin');

    const response = await backend.request('/v1/admin/sign-out', {
      method: 'POST',
      headers: adminHeaders(cookie),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    await expect(client.admin.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('opens Безпека to a Власник only', async () => {
    const backend = await adminOn();
    const adminUser = await signedInAdmin(backend, 'admin');

    await expect(adminUser.client.admin.actions({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(backend.owner.client.admin.actions({})).resolves.toHaveProperty('actions');
  });
});

describe("the vault of the admin's TOTP secrets", () => {
  it('opens what it sealed and refuses a value whose tag was cut short', () => {
    const vault = createSecretVault(`fake-secret-${randomUUID()}`);
    const sealed = vault.seal('JBSWY3DPEHPK3PXP');
    const [iv = '', tag = '', body = ''] = sealed.split('.');
    const short = Buffer.from(tag, 'base64url').subarray(0, 4).toString('base64url');

    expect(vault.open(sealed)).toBe('JBSWY3DPEHPK3PXP');
    expect(vault.open([iv, short, body].join('.'))).toBeUndefined();
  });
});
