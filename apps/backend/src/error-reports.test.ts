import { randomBytes } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from './database/database';
import { createTestDatabase, newIp, silentLogger, testApp, testDatabaseUrl } from './test-support';

const EMAIL = 'anna@mail.com';
const CODE = '123456';
/** A random run of token characters, made when the test runs, so the repo holds no token. */
const randomToken = () => randomBytes(24).toString('base64url');
const SESSION_TOKEN = randomToken();

describe('an unexpected failure', () => {
  it('reaches the error reporter with its kind, its stack and the request id', async () => {
    const { client, reports } = testApp({
      google: { verify: () => Promise.reject(new Error('Google did not answer')) },
    });

    const failure = client.account.signInWithGoogle({ idToken: 'a-token', editionId: 'uk' });

    await expect(failure).rejects.toMatchObject({ status: 500 });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      name: 'Error',
      message: 'Google did not answer',
      stack: expect.stringContaining('\n    at ') as unknown,
      requestId: expect.stringMatching(/\S/) as unknown,
    });
  });

  it('reaches it with no email, IP address, token, Sign-in code or body', async () => {
    const ip = newIp();
    // Shaped as a Google identity token: header, payload and signature.
    const idToken = [randomToken(), randomToken(), randomToken()].join('.');
    const { request, reports } = testApp({
      // An error that quotes everything the request brought.
      google: {
        verify: (token) =>
          Promise.reject(
            new Error(
              `${EMAIL} from ${ip} sent ${token} with code ${CODE} and Bearer ${SESSION_TOKEN}`,
            ),
          ),
      },
    });

    const response = await request(
      '/v1/account/google-sessions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ idToken, editionId: 'uk' }),
      },
      ip,
    );

    expect(response.status).toBe(500);
    expect(reports).toHaveLength(1);
    const sent = JSON.stringify(reports);
    for (const personal of [EMAIL, ip, idToken, CODE, SESSION_TOKEN]) {
      expect(sent).not.toContain(personal);
    }
  });

  it('reaches it from a failed query with no value of the query', async () => {
    const own = await createTestDatabase(testDatabaseUrl());
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    // Postgres refuses the window of an email's codes, and its detail quotes the row.
    await database.db.execute(
      sql`alter table rate_limits add constraint refuses_emails check (key not like 'codesPerEmail:%')`,
    );
    const { client, reports } = testApp({ database });

    const failure = client.account.requestCode({ email: EMAIL, editionId: 'uk' });

    await expect(failure).rejects.toMatchObject({ status: 500 });
    expect(reports).toMatchObject([
      { name: 'DrizzleQueryError', message: expect.stringContaining('SQLSTATE 23514') as unknown },
    ]);
    expect(JSON.stringify(reports)).not.toContain(EMAIL);
  });

  it('reaches it when it happens outside the API', async () => {
    const { app, reports } = testApp();

    // A request made in process comes on no connection, which breaks an invariant.
    const response = await app.request('/health');

    expect(response.status).toBe(500);
    expect(reports).toMatchObject([{ message: 'the request came on no connection' }]);
  });
});

describe('a refused request', () => {
  it('does not reach the error reporter', async () => {
    const { client, reports } = testApp();

    const refused = client.account.verifyCode({ email: EMAIL, code: CODE });

    await expect(refused).rejects.toMatchObject({ status: 400 });
    await expect(
      client.account.signInWithGoogle({ idToken: 'forged', editionId: 'uk' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(reports).toEqual([]);
  });
});
