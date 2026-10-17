import { randomUUID } from 'node:crypto';

import type { Clock } from '@slovo/server-core';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from '../database/database';
import {
  connectionFrom,
  createFakeMailer,
  createTestDatabase,
  newIp,
  silentLogger,
  testApp,
  testDatabaseServer,
  type TestDatabase,
} from '../test-support';

const MINUTE = 60 * 1000;

/** An email no other test uses. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** A clock the test moves on; it starts at the real time. */
function movingClock() {
  let now = Date.now();
  const clock: Clock = { now: () => new Date(now) };
  return {
    clock,
    moveOn: (ms: number) => {
      now += ms;
    },
  };
}

// The limits count on a database of their own. The backend forgets the
// windows that have ended by its clock, so another test that moves the clock
// on by days would end these windows on the shared one.
let limitsDatabase: TestDatabase;
beforeAll(async () => {
  limitsDatabase = await createTestDatabase(testDatabaseServer());
});
afterAll(() => limitsDatabase.drop());

/** The backend on a clock the test moves, with a fake Mailer. */
function limitedApp() {
  const { clock, moveOn } = movingClock();
  const mailer = createFakeMailer();
  const database = createDatabase(limitsDatabase.url, silentLogger);
  const backend = testApp({ clock, mailer, database });
  onTestFinished(backend.close);
  // A request the client doesn't make, to read the answer's status and headers.
  const post = (path: string, body: object, ip: string) =>
    backend.app.request(
      `/v1/account/${path}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      connectionFrom(ip),
    );
  return {
    ...backend,
    mailer,
    moveOn,
    requestCode: (email: string, ip = backend.ip) =>
      post('sign-in-codes', { email, editionId: 'uk' }, ip),
    verifyCode: (email: string, ip = backend.ip) => post('sessions', { email, code: '000000' }, ip),
  };
}

/** What a refused request answers: 429 `TOO_MANY_REQUESTS` with `Retry-After` in seconds. */
async function refusal(response: Response) {
  return {
    status: response.status,
    code: ((await response.json()) as { code: string }).code,
    retryAfter: response.headers.get('retry-after'),
  };
}

describe('the codes sent to one email', () => {
  it('are at most 5 an hour: the 6th is TOO_MANY_REQUESTS with Retry-After, and sends nothing', async () => {
    const { client, clientFrom, requestCode, mailer, moveOn } = limitedApp();
    const email = newEmail();
    // From several IP addresses, so only the limit of the email holds.
    for (let sent = 0; sent < 5; sent++) {
      await clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' });
      moveOn(10 * MINUTE);
    }

    const sixth = await requestCode(email, newIp());

    expect(await refusal(sixth)).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      // The hour began with the first code, 50 minutes ago.
      retryAfter: '600',
    });
    expect(mailer.sent.filter((mail) => mail.to === email)).toHaveLength(5);
    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'uk' }),
    ).resolves.toEqual({});
  });

  it('open again when the hour has passed', async () => {
    const { clientFrom, requestCode, mailer, moveOn } = limitedApp();
    const email = newEmail();
    for (let sent = 0; sent < 5; sent++) {
      await clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' });
    }
    moveOn(60 * MINUTE - 1000);
    expect((await requestCode(email, newIp())).status).toBe(429);

    moveOn(1000);

    await expect(
      clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' }),
    ).resolves.toEqual({});
    expect(mailer.sent.filter((mail) => mail.to === email)).toHaveLength(6);
  });
});

describe('the code requests from one IP address', () => {
  it('are at most 20 in 10 minutes: the 21st is TOO_MANY_REQUESTS with Retry-After, and sends nothing', async () => {
    const { client, clientFrom, requestCode, mailer, moveOn } = limitedApp();
    for (let sent = 0; sent < 20; sent++) {
      await client.account.requestCode({ email: newEmail(), editionId: 'uk' });
    }
    moveOn(4 * MINUTE);
    const email = newEmail();

    const twentyFirst = await requestCode(email);

    expect(await refusal(twentyFirst)).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      retryAfter: '360',
    });
    expect(mailer.sent.filter((mail) => mail.to === email)).toEqual([]);
    expect(mailer.sent).toHaveLength(20);
    // Another IP address is not held back.
    await expect(
      clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' }),
    ).resolves.toEqual({});
  });

  it('open again when the 10 minutes have passed', async () => {
    const { client, requestCode, moveOn } = limitedApp();
    for (let sent = 0; sent < 20; sent++) {
      await client.account.requestCode({ email: newEmail(), editionId: 'uk' });
    }
    expect((await requestCode(newEmail())).status).toBe(429);

    moveOn(10 * MINUTE);

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'uk' }),
    ).resolves.toEqual({});
  });
});

describe('the code checks from one IP address', () => {
  it('are at most 30 in 10 minutes: the 31st is TOO_MANY_REQUESTS with Retry-After', async () => {
    const { client, clientFrom, verifyCode, mailer, moveOn } = limitedApp();
    for (let checked = 0; checked < 30; checked++) {
      await expect(verifyCode(newEmail())).resolves.toMatchObject({ status: 400 });
    }
    moveOn(9 * MINUTE + 59_500);
    // The right code, so only the limit refuses it.
    const email = newEmail();
    await clientFrom(newIp()).account.requestCode({ email, editionId: 'uk' });

    const thirtyFirst = client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    await expect(thirtyFirst).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429 });
    expect(await refusal(await verifyCode(email))).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      // Half a second is left, which counts as a whole one.
      retryAfter: '1',
    });
    // Another IP address is not held back.
    await expect(
      clientFrom(newIp()).account.verifyCode({ email, code: mailer.codeSentTo(email) }),
    ).resolves.toMatchObject({ email });
  });

  it('open again when the 10 minutes have passed', async () => {
    const { client, verifyCode, mailer, moveOn } = limitedApp();
    for (let checked = 0; checked < 30; checked++) {
      await verifyCode(newEmail());
    }
    const email = newEmail();
    await client.account.requestCode({ email, editionId: 'uk' });
    expect((await verifyCode(email)).status).toBe(429);

    moveOn(10 * MINUTE);

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
      retryAfter: null,
    });
  });
});
