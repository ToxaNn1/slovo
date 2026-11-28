import type { Clock } from '@slovo/server-core';
import { exportPKCS8, generateKeyPair, jwtVerify, type CryptoKey } from 'jose';
import { describe, expect, it } from 'vitest';

import { UK_BUNDLE_ID } from '../test-support';
import { createAppleRevoker, importAppleKey, type AppleKey } from './apple-revoker';

const NOW = new Date('2026-11-28T12:00:00.000Z');
const clock: Clock = { now: () => NOW };

/** A Sign in with Apple key as the owner downloads it: its .p8 contents, and the public half to check the client secret. */
async function appleKey(): Promise<{ key: AppleKey; publicKey: CryptoKey; pem: string }> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const pem = await exportPKCS8(privateKey);
  const key = await importAppleKey({ teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: pem });
  return { key, publicKey, pem };
}

/** One request the revoker sent to Apple: where to, and its form. */
interface SentToApple {
  readonly url: string;
  readonly form: Record<string, string>;
}

type Answer = Response | 'unreachable';

/**
 * Apple's token and revoke endpoints: each answers what the test said, a
 * token exchange with a refresh token and a revocation with 200 unless told
 * otherwise, and keeps every request.
 */
function appleEndpoints({
  token = Response.json({ access_token: 'access-1', refresh_token: 'refresh-1' }),
  revoke = new Response('', { status: 200 }),
}: { token?: Answer; revoke?: Answer } = {}) {
  const sent: SentToApple[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    sent.push({ url, form: Object.fromEntries(body) });
    const answer = url.endsWith('/auth/token') ? token : revoke;
    if (answer === 'unreachable') throw new TypeError('fetch failed');
    return Promise.resolve(answer);
  };
  return { fetch, sent };
}

describe('revoking SLOVO at Apple with an authorization code', () => {
  it('exchanges the code for a refresh token and revokes it, with a client secret Apple checks', async () => {
    const { key, publicKey } = await appleKey();
    const apple = appleEndpoints();
    const revoker = createAppleRevoker({ key, fetch: apple.fetch, clock });

    const revoked = await revoker.revoke('code-1', UK_BUNDLE_ID);

    expect(revoked).toEqual({ ok: true });
    expect(apple.sent.map(({ url }) => url)).toEqual([
      'https://appleid.apple.com/auth/token',
      'https://appleid.apple.com/auth/revoke',
    ]);
    const [exchange, revocation] = apple.sent;
    expect(exchange?.form).toEqual({
      client_id: UK_BUNDLE_ID,
      client_secret: expect.any(String) as unknown,
      code: 'code-1',
      grant_type: 'authorization_code',
    });
    expect(revocation?.form).toEqual({
      client_id: UK_BUNDLE_ID,
      client_secret: exchange?.form['client_secret'],
      token: 'refresh-1',
      token_type_hint: 'refresh_token',
    });
    const secret = await jwtVerify(exchange?.form['client_secret'] ?? '', publicKey, {
      currentDate: NOW,
    });
    expect(secret.protectedHeader).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(secret.payload).toEqual({
      iss: 'TEAM123456',
      sub: UK_BUNDLE_ID,
      aud: 'https://appleid.apple.com',
      iat: NOW.getTime() / 1000,
      exp: NOW.getTime() / 1000 + 300,
    });
  });

  it('revokes the access token when Apple hands out no refresh token', async () => {
    const { key } = await appleKey();
    const apple = appleEndpoints({ token: Response.json({ access_token: 'access-1' }) });

    const revoked = await createAppleRevoker({ key, fetch: apple.fetch, clock }).revoke(
      'code-1',
      UK_BUNDLE_ID,
    );

    expect(revoked).toEqual({ ok: true });
    expect(apple.sent[1]?.form).toMatchObject({
      token: 'access-1',
      token_type_hint: 'access_token',
    });
  });

  it('fails, naming no code or token, when Apple refuses the code', async () => {
    const { key } = await appleKey();
    const apple = appleEndpoints({
      token: Response.json({ error: 'invalid_grant' }, { status: 400 }),
    });

    const revoked = await createAppleRevoker({ key, fetch: apple.fetch, clock }).revoke(
      'code-1',
      UK_BUNDLE_ID,
    );

    expect(revoked).toMatchObject({ ok: false, reason: 'failed' });
    const message = revoked.ok || revoked.reason !== 'failed' ? '' : revoked.error.message;
    expect(message).toBe("Apple's token endpoint answered 400 invalid_grant");
    expect(apple.sent).toHaveLength(1);
  });

  it('fails when Apple refuses the revocation', async () => {
    const { key } = await appleKey();
    const apple = appleEndpoints({ revoke: new Response('', { status: 503 }) });

    const revoked = await createAppleRevoker({ key, fetch: apple.fetch, clock }).revoke(
      'code-1',
      UK_BUNDLE_ID,
    );

    expect(revoked).toMatchObject({ ok: false, reason: 'failed' });
    expect(revoked.ok || revoked.reason !== 'failed' ? '' : revoked.error.message).toBe(
      "Apple's revoke endpoint answered 503",
    );
  });

  it('fails when Apple cannot be reached', async () => {
    const { key } = await appleKey();
    const apple = appleEndpoints({ token: 'unreachable' });

    const revoked = await createAppleRevoker({ key, fetch: apple.fetch, clock }).revoke(
      'code-1',
      UK_BUNDLE_ID,
    );

    expect(revoked).toMatchObject({ ok: false, reason: 'failed' });
    expect(revoked.ok || revoked.reason !== 'failed' ? '' : revoked.error.message).toBe(
      "Apple's token endpoint could not be reached: TypeError",
    );
  });

  it('asks Apple nothing without a Sign in with Apple key', async () => {
    const apple = appleEndpoints();

    const revoked = await createAppleRevoker({ key: undefined, fetch: apple.fetch, clock }).revoke(
      'code-1',
      UK_BUNDLE_ID,
    );

    expect(revoked).toEqual({ ok: false, reason: 'not-configured' });
    expect(apple.sent).toEqual([]);
  });

  it('takes a .p8 whose line breaks a host form turned into \\n', async () => {
    const { pem } = await appleKey();

    await expect(
      importAppleKey({
        teamId: 'TEAM123456',
        keyId: 'KEY1234567',
        privateKey: pem.trim().replaceAll('\n', '\\n'),
      }),
    ).resolves.toMatchObject({ teamId: 'TEAM123456', keyId: 'KEY1234567' });
  });
});
