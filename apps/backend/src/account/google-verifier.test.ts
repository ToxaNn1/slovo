import { randomUUID } from 'node:crypto';

import { systemClock, type Clock } from '@slovo/server-core';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { describe, expect, it } from 'vitest';

import { passTime, TEST_GOOGLE_CLIENT_ID, testApp } from '../test-support';
import { createGoogleVerifier } from './google-verifier';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** A signing key of the fake Google: its private half, and its public half as Google publishes it. */
async function googleKey() {
  const kid = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const published: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { kid, privateKey, published };
}

type GoogleKey = Awaited<ReturnType<typeof googleKey>>;

/**
 * An identity token for the email as Google signs it with the key, issued at
 * the time for an hour, for SLOVO's app unless another audience is named.
 */
function tokenOf(
  key: { kid: string; privateKey: CryptoKey },
  email: string,
  { at = new Date(), audience = TEST_GOOGLE_CLIENT_ID }: { at?: Date; audience?: string } = {},
) {
  return new SignJWT({ email, email_verified: true })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid, typ: 'JWT' })
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setSubject(`google-${email}`)
    .setIssuedAt(at)
    .setExpirationTime(new Date(at.getTime() + HOUR))
    .sign(key.privateKey);
}

/**
 * Google's keys endpoint, as the real verifier fetches it: it publishes the
 * keys it is given, kept for an hour, or fails when told to.
 */
function googleKeysEndpoint(keys: GoogleKey[]) {
  const fetched: string[] = [];
  let failure: 'answers 503' | 'unreachable' | undefined;
  const fetch: typeof globalThis.fetch = (input) => {
    fetched.push(input instanceof Request ? input.url : String(input));
    if (failure === 'unreachable') return Promise.reject(new TypeError('fetch failed'));
    if (failure === 'answers 503') return Promise.resolve(new Response('', { status: 503 }));
    return Promise.resolve(
      new Response(JSON.stringify({ keys: keys.map((key) => key.published) }), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=3600, must-revalidate, no-transform',
        },
      }),
    );
  };
  return {
    fetch,
    /** Every URL fetched, oldest first. */
    fetched: fetched as readonly string[],
    fail: (how: typeof failure) => {
      failure = how;
    },
  };
}

/**
 * The backend verifying Google's tokens with the real verifier, which fetches
 * the keys from the endpoint and reads the time from the clock, the test's
 * unless another is given.
 */
async function backendWithGoogle(clock: Clock = systemClock) {
  const key = await googleKey();
  const keys = [key];
  const endpoint = googleKeysEndpoint(keys);
  const backend = testApp({
    google: createGoogleVerifier({
      clientIds: [TEST_GOOGLE_CLIENT_ID],
      fetch: endpoint.fetch,
      clock,
    }),
  });
  const signIn = async (idToken: string) =>
    backend.client.account.signInWithGoogle({ idToken, editionId: 'uk' });
  return { ...backend, key, keys, endpoint, signIn };
}

const newEmail = () => `reader-${randomUUID()}@example.com`;

describe("Google's keys", () => {
  it('are fetched once from Google for two sign-ins', async () => {
    const { key, endpoint, signIn } = await backendWithGoogle();

    await signIn(await tokenOf(key, newEmail()));
    await signIn(await tokenOf(key, newEmail()));

    expect(endpoint.fetched).toEqual(['https://www.googleapis.com/oauth2/v3/certs']);
  });

  it('are fetched again once the time Google keeps them for has passed', async () => {
    const { key, endpoint, signIn } = await backendWithGoogle();
    await signIn(await tokenOf(key, newEmail()));

    passTime(HOUR - MINUTE);
    await signIn(await tokenOf(key, newEmail()));
    expect(endpoint.fetched).toHaveLength(1);

    passTime(2 * MINUTE);
    await signIn(await tokenOf(key, newEmail()));
    expect(endpoint.fetched).toHaveLength(2);
  });

  it('expire by the clock the verifier is given, which also dates the tokens', async () => {
    let now = new Date();
    const { key, endpoint, signIn } = await backendWithGoogle({ now: () => now });
    await signIn(await tokenOf(key, newEmail(), { at: now }));

    now = new Date(now.getTime() + HOUR + MINUTE);

    await expect(signIn(await tokenOf(key, newEmail(), { at: now }))).resolves.toMatchObject({
      token: expect.any(String) as unknown,
    });
    expect(endpoint.fetched).toHaveLength(2);
  });

  it('are fetched again for a token signed with a key Google has published since', async () => {
    const { key, keys, endpoint, signIn } = await backendWithGoogle();
    await signIn(await tokenOf(key, newEmail()));
    const newKey = await googleKey();
    keys.push(newKey);
    passTime(MINUTE);

    await expect(signIn(await tokenOf(newKey, newEmail()))).resolves.toMatchObject({
      token: expect.any(String) as unknown,
    });
    expect(endpoint.fetched).toHaveLength(2);
  });

  it('are not fetched for what is not a Google identity token, which is INVALID_TOKEN', async () => {
    const { endpoint, signIn } = await backendWithGoogle();

    await expect(signIn('not-a-token')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(endpoint.fetched).toEqual([]);
  });

  it('do not check a token Google did not sign, which is INVALID_TOKEN', async () => {
    const { key, signIn, reports } = await backendWithGoogle();
    const forged = await tokenOf({ ...(await googleKey()), kid: key.kid }, newEmail());

    await expect(signIn(forged)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(reports).toEqual([]);
  });

  it('do not check a token Google did not sign that names another app, which is INVALID_TOKEN', async () => {
    const { key, signIn } = await backendWithGoogle();
    const forged = await tokenOf({ ...(await googleKey()), kid: key.kid }, newEmail(), {
      audience: 'another-app.example',
    });

    await expect(signIn(forged)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('check a token Google signed for another app, which is FOREIGN_AUDIENCE', async () => {
    const { key, signIn } = await backendWithGoogle();
    const foreign = await tokenOf(key, newEmail(), { audience: 'another-app.example' });

    await expect(signIn(foreign)).rejects.toMatchObject({ code: 'FOREIGN_AUDIENCE' });
  });

  for (const failure of ['answers 503', 'unreachable'] as const) {
    it(`that Google cannot give (its endpoint ${failure}) make the sign-in a 500, reported once`, async () => {
      const { key, endpoint, signIn, reports } = await backendWithGoogle();
      endpoint.fail(failure);

      await expect(signIn(await tokenOf(key, newEmail()))).rejects.toMatchObject({ status: 500 });
      expect(reports).toHaveLength(1);
    });
  }
});
