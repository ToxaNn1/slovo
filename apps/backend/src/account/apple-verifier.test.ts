import { randomUUID } from 'node:crypto';

import { systemClock, type Clock } from '@slovo/server-core';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { describe, expect, it } from 'vitest';

import { APPLE_ISSUER, passTime, testApp, UK_BUNDLE_ID } from '../test-support';
import { createAppleVerifier } from './apple-verifier';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** A signing key of the fake Apple: its private half, and its public half as Apple publishes it. */
async function appleKey() {
  const kid = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const published: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { kid, privateKey, published };
}

type AppleKey = Awaited<ReturnType<typeof appleKey>>;

/**
 * An identity token for the email as Apple signs it with the key, issued at
 * the time for ten minutes, by Apple for the UA Edition's app unless
 * another issuer or audience is named.
 */
function tokenOf(
  key: { kid: string; privateKey: CryptoKey },
  email: string,
  {
    at = new Date(),
    audience = UK_BUNDLE_ID,
    issuer = APPLE_ISSUER,
  }: { at?: Date; audience?: string; issuer?: string } = {},
) {
  return new SignJWT({ email, email_verified: 'true', is_private_email: 'false' })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(`001234.${email}`)
    .setIssuedAt(at)
    .setExpirationTime(new Date(at.getTime() + 10 * MINUTE))
    .sign(key.privateKey);
}

/**
 * Apple's keys endpoint, as the real verifier fetches it: it publishes the
 * keys it is given, kept for as long as the answer says, or fails when told to.
 */
function appleKeysEndpoint(keys: AppleKey[]) {
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
          'cache-control': 'max-age=3600, public',
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
 * The backend verifying Apple's tokens with the real verifier, which fetches
 * the keys from the endpoint and reads the time from the clock, the test's
 * unless another is given.
 */
async function backendWithApple(clock: Clock = systemClock) {
  const key = await appleKey();
  const keys = [key];
  const endpoint = appleKeysEndpoint(keys);
  const backend = testApp({ apple: createAppleVerifier({ fetch: endpoint.fetch, clock }) });
  const signIn = async (idToken: string) =>
    backend.client.account.signInWithApple({ idToken, editionId: 'uk' });
  return { ...backend, key, keys, endpoint, signIn };
}

const newEmail = () => `reader-${randomUUID()}@example.com`;

describe("a token Apple signed for the Edition's app", () => {
  it('signs the email in, and its keys are fetched once from Apple for two sign-ins', async () => {
    const { key, endpoint, signIn, rowsOf } = await backendWithApple();
    const email = newEmail();

    await expect(signIn(await tokenOf(key, email))).resolves.toMatchObject({ email });
    await signIn(await tokenOf(key, newEmail()));

    expect(endpoint.fetched).toEqual(['https://appleid.apple.com/auth/keys']);
    expect(await rowsOf(email)).toMatchObject({
      accountRows: 1,
      signInMethods: [{ providerId: 'apple', providerAccountId: `001234.${email}` }],
    });
  });

  it('signs a private relay address in', async () => {
    const { key, signIn } = await backendWithApple();
    const email = `${randomUUID().slice(0, 12)}@privaterelay.appleid.com`;

    await expect(signIn(await tokenOf(key, email))).resolves.toMatchObject({ email });
  });
});

describe("Apple's keys", () => {
  it('are fetched again once the time Apple keeps them for has passed', async () => {
    const { key, endpoint, signIn } = await backendWithApple();
    await signIn(await tokenOf(key, newEmail()));

    passTime(HOUR - MINUTE);
    await signIn(await tokenOf(key, newEmail()));
    expect(endpoint.fetched).toHaveLength(1);

    passTime(2 * MINUTE);
    await signIn(await tokenOf(key, newEmail()));
    expect(endpoint.fetched).toHaveLength(2);
  });

  it('are fetched again for a token signed with a key Apple has published since', async () => {
    const { key, keys, endpoint, signIn } = await backendWithApple();
    await signIn(await tokenOf(key, newEmail()));
    const newKey = await appleKey();
    keys.push(newKey);
    passTime(MINUTE);

    await expect(signIn(await tokenOf(newKey, newEmail()))).resolves.toMatchObject({
      token: expect.any(String) as unknown,
    });
    expect(endpoint.fetched).toHaveLength(2);
  });

  for (const failure of ['answers 503', 'unreachable'] as const) {
    it(`that Apple cannot give (its endpoint ${failure}) make the sign-in a 500, reported once`, async () => {
      const { key, endpoint, signIn, reports } = await backendWithApple();
      endpoint.fail(failure);

      await expect(signIn(await tokenOf(key, newEmail()))).rejects.toMatchObject({ status: 500 });
      expect(reports).toHaveLength(1);
    });
  }
});

describe('a token is refused as INVALID_TOKEN, with no Account made, when it', () => {
  it('is not a token at all, without fetching the keys', async () => {
    const { endpoint, signIn } = await backendWithApple();

    await expect(signIn('not-a-token')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(endpoint.fetched).toEqual([]);
  });

  it('was not signed by Apple', async () => {
    const { key, signIn, reports, rowsOf } = await backendWithApple();
    const email = newEmail();
    const forged = await tokenOf({ ...(await appleKey()), kid: key.kid }, email);

    await expect(signIn(forged)).rejects.toMatchObject({ code: 'INVALID_TOKEN', status: 401 });
    expect(reports).toEqual([]);
    expect((await rowsOf(email)).account).toBeUndefined();
  });

  it('comes from another issuer', async () => {
    const { key, signIn, rowsOf } = await backendWithApple();
    const email = newEmail();
    const foreign = await tokenOf(key, email, { issuer: 'https://accounts.google.com' });

    await expect(signIn(foreign)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect((await rowsOf(email)).account).toBeUndefined();
  });

  it('has expired by the clock the verifier is given', async () => {
    let now = new Date();
    const { key, signIn, rowsOf } = await backendWithApple({ now: () => now });
    const email = newEmail();
    const idToken = await tokenOf(key, email, { at: now });
    now = new Date(now.getTime() + 11 * MINUTE);

    await expect(signIn(idToken)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect((await rowsOf(email)).account).toBeUndefined();
  });

  it('names no email', async () => {
    const { key, signIn } = await backendWithApple();
    const withoutEmail = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: key.kid })
      .setIssuer(APPLE_ISSUER)
      .setAudience(UK_BUNDLE_ID)
      .setSubject('001234.nobody')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(key.privateKey);

    await expect(signIn(withoutEmail)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });
});

describe('a token Apple signed for another app', () => {
  it('is FOREIGN_AUDIENCE, with no Account made', async () => {
    const { key, signIn, rowsOf } = await backendWithApple();
    const email = newEmail();
    const foreign = await tokenOf(key, email, { audience: 'app.slovo.another' });

    await expect(signIn(foreign)).rejects.toMatchObject({ code: 'FOREIGN_AUDIENCE', status: 401 });
    expect((await rowsOf(email)).account).toBeUndefined();
  });

  it('is INVALID_TOKEN when Apple did not sign it either', async () => {
    const { key, signIn } = await backendWithApple();
    const forged = await tokenOf({ ...(await appleKey()), kid: key.kid }, newEmail(), {
      audience: 'app.slovo.another',
    });

    await expect(signIn(forged)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });
});
