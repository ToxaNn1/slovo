import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { newIp, passTime, testApp } from '../test-support';

const MINUTE = 60 * 1000;

/** An email no other test uses. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** The backend, and the sign-in requests whose answers' status and headers a test reads. */
function limitedApp() {
  const backend = testApp();
  const post = (path: string, body: object, ip?: string) =>
    backend.request(
      `/v1/account/${path}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      ip,
    );
  return {
    ...backend,
    requestCode: (email: string, ip?: string) =>
      post('sign-in-codes', { email, editionId: 'uk' }, ip),
    verifyCode: (email: string, ip?: string) => post('sessions', { email, code: '000000' }, ip),
    signInWithGoogle: (email: string, ip?: string) =>
      post('google-sessions', { idToken: backend.google.token({ email }), editionId: 'uk' }, ip),
  };
}

/**
 * What a refused request answers: 429 `TOO_MANY_REQUESTS` with the contract's
 * message and `Retry-After` in seconds.
 */
async function refusal(response: Response) {
  const { code, message } = (await response.json()) as { code: string; message: string };
  return {
    status: response.status,
    code,
    message,
    retryAfter: response.headers.get('retry-after'),
  };
}

describe('the codes sent to one email', () => {
  it('are at most 5 an hour: the 6th is TOO_MANY_REQUESTS with Retry-After, and sends nothing', async () => {
    const { client, clientFrom, requestCode, mailer } = limitedApp();
    const email = newEmail();
    // From several IP addresses, so only the limit of the email holds.
    for (let sent = 0; sent < 5; sent++) {
      await clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' });
      passTime(10 * MINUTE);
    }

    const sixth = await requestCode(email, newIp());

    expect(await refusal(sixth)).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      // The hour began with the first code, 50 minutes ago.
      retryAfter: '600',
    });
    expect(mailer.sent.filter((mail) => mail.to === email)).toHaveLength(5);
    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'uk' }),
    ).resolves.toEqual({});
  });

  it('open again when the hour has passed', async () => {
    const { clientFrom, requestCode, mailer } = limitedApp();
    const email = newEmail();
    for (let sent = 0; sent < 5; sent++) {
      await clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' });
    }
    passTime(60 * MINUTE - 1000);
    expect((await requestCode(email, newIp())).status).toBe(429);

    passTime(1000);

    await expect(
      clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' }),
    ).resolves.toEqual({});
    expect(mailer.sent.filter((mail) => mail.to === email)).toHaveLength(6);
  });
});

describe('the code requests from one IP address', () => {
  it('are at most 20 in 10 minutes: the 21st is TOO_MANY_REQUESTS with Retry-After, and sends nothing', async () => {
    const { client, clientFrom, requestCode, mailer } = limitedApp();
    for (let sent = 0; sent < 20; sent++) {
      await client.account.requestCode({ email: newEmail(), editionId: 'uk' });
    }
    passTime(4 * MINUTE);
    const email = newEmail();

    const twentyFirst = await requestCode(email);

    expect(await refusal(twentyFirst)).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      retryAfter: '360',
    });
    expect(mailer.sent.filter((mail) => mail.to === email)).toEqual([]);
    expect(mailer.sent).toHaveLength(20);
    // Another IP address is not held back.
    await expect(
      clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' }),
    ).resolves.toEqual({});
  });

  it('count the IP address of the connection, whatever X-Forwarded-For says', async () => {
    const { request, mailer } = limitedApp();
    // Anyone can send the header, so a new address in each one changes nothing.
    const requestCodeForwarded = (email: string) =>
      request('/v1/account/sign-in-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': newIp() },
        body: JSON.stringify({ email, editionId: 'uk' }),
      });
    for (let sent = 0; sent < 20; sent++) {
      expect((await requestCodeForwarded(newEmail())).status).toBe(200);
    }

    const twentyFirst = await requestCodeForwarded(newEmail());

    expect(twentyFirst.status).toBe(429);
    expect(mailer.sent).toHaveLength(20);
  });

  it('open again when the 10 minutes have passed', async () => {
    const { client, requestCode } = limitedApp();
    for (let sent = 0; sent < 20; sent++) {
      await client.account.requestCode({ email: newEmail(), editionId: 'uk' });
    }
    expect((await requestCode(newEmail())).status).toBe(429);

    passTime(10 * MINUTE);

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'uk' }),
    ).resolves.toEqual({});
  });
});

describe('the code checks from one IP address', () => {
  it('are at most 30 in 10 minutes: the 31st is TOO_MANY_REQUESTS with Retry-After', async () => {
    const { client, clientFrom, verifyCode, mailer } = limitedApp();
    for (let checked = 0; checked < 30; checked++) {
      await expect(verifyCode(newEmail())).resolves.toMatchObject({ status: 400 });
    }
    passTime(9 * MINUTE + 59_500);
    // The right code, so only the limit refuses it.
    const email = newEmail();
    await clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' });

    const thirtyFirst = client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    await expect(thirtyFirst).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429 });
    expect(await refusal(await verifyCode(email))).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      // Half a second is left, which counts as a whole one.
      retryAfter: '1',
    });
    // Another IP address is not held back.
    await expect(
      clientFrom(newIp()).account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });

  it('open again when the 10 minutes have passed', async () => {
    const { client, verifyCode, mailer } = limitedApp();
    for (let checked = 0; checked < 30; checked++) {
      await verifyCode(newEmail());
    }
    const email = newEmail();
    expect((await verifyCode(email)).status).toBe(429);

    passTime(10 * MINUTE);

    // A code lasts as long as the window, so the right one is sent now.
    await client.account.requestCode({ email, editionId: 'uk' });
    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });
});

describe('a spent Sign-in code', () => {
  it('is TOO_MANY_REQUESTS without Retry-After: only a new code signs in, however long one waits', async () => {
    const { client, verifyCode, mailer } = limitedApp();
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    const code = mailer.codeSentTo(email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let tries = 0; tries < 5; tries++) {
      await client.account.verifyCode({ email, code: wrong }).catch(() => undefined);
    }

    expect(await refusal(await verifyCode(email))).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      retryAfter: null,
    });
  });
});

describe('the Google sign-ins from one IP address', () => {
  it('are at most 30 in 10 minutes: the 31st is TOO_MANY_REQUESTS with Retry-After', async () => {
    const { clientFrom, google, signInWithGoogle } = limitedApp();
    for (let signedIn = 0; signedIn < 30; signedIn++) {
      await expect(signInWithGoogle(newEmail())).resolves.toMatchObject({ status: 200 });
    }
    passTime(9 * MINUTE + 59_500);

    const email = newEmail();
    expect(await refusal(await signInWithGoogle(email))).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
      // Half a second is left, which counts as a whole one.
      retryAfter: '1',
    });
    // Another IP address is not held back.
    await expect(
      clientFrom(newIp()).account.signInWithGoogle({
        idToken: google.token({ email }),
        editionId: 'uk',
      }),
    ).resolves.toMatchObject({ email });
  });

  it('open again when the 10 minutes have passed, and leave the code checks uncounted', async () => {
    const { client, mailer, signInWithGoogle } = limitedApp();
    for (let signedIn = 0; signedIn < 30; signedIn++) {
      await signInWithGoogle(newEmail());
    }
    const email = newEmail();
    expect((await signInWithGoogle(email)).status).toBe(429);
    await client.account.requestCode({ email, editionId: 'uk' });
    await expect(
      client.account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });

    passTime(10 * MINUTE);

    expect((await signInWithGoogle(email)).status).toBe(200);
  });
});
