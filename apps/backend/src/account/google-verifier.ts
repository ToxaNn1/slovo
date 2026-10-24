import type { GoogleVerifier } from '@slovo/server-core';
import { createRemoteJWKSet, customFetch, errors, jwtVerify, type JWTPayload } from 'jose';

/** Where Google publishes the keys it signs identity tokens with. */
const GOOGLE_KEYS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

/** How long the keys are kept when Google's answer doesn't say. */
const DEFAULT_KEYS_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * What a token that is not a good Google identity token for SLOVO fails
 * with: it is no JWT, its algorithm is not Google's, no key of Google's
 * matches it, its signature doesn't check, or a claim is wrong. Any other
 * failure, such as fetching Google's keys, is not the token's fault.
 */
const BAD_TOKEN_ERRORS = [
  errors.JWSInvalid,
  errors.JWTInvalid,
  errors.JWTClaimValidationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys,
  errors.JWSSignatureVerificationFailed,
];

/** How long an answer's `Cache-Control` lets it be kept, in milliseconds. */
function maxAgeOf(response: Response): number {
  const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '');
  return maxAge?.[1] === undefined ? DEFAULT_KEYS_MAX_AGE_MS : Number(maxAge[1]) * 1000;
}

/**
 * Google's keys, fetched when first needed and kept for as long as Google's
 * answer says, then fetched again. A token signed with a key not among them
 * fetches them again too, at most every 30 seconds (jose's cooldown), for a
 * key Google has published since.
 */
function googleKeys(fetch: typeof globalThis.fetch) {
  let expiresAt = 0;
  const keys = createRemoteJWKSet(GOOGLE_KEYS_URL, {
    // Kept until Google's max-age, which `get` checks, not jose's own.
    cacheMaxAge: Number.POSITIVE_INFINITY,
    [customFetch]: async (url, init) => {
      const response = await fetch(url, init);
      if (response.ok) expiresAt = Date.now() + maxAgeOf(response);
      return response;
    },
  });
  return {
    async get() {
      if (keys.fresh && Date.now() >= expiresAt) await keys.reload();
      return keys;
    },
  };
}

/**
 * The audience a Google identity token names, read without checking it: for
 * telling a token of another app from one that doesn't check at all. None
 * when the token is not even a JWT.
 */
function unverifiedAudience(idToken: string): readonly string[] | undefined {
  const payload = idToken.split('.')[1];
  if (payload === undefined) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { aud?: unknown };
    if (typeof claims.aud === 'string') return [claims.aud];
    if (Array.isArray(claims.aud)) return claims.aud.filter((aud) => typeof aud === 'string');
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * The token's claims once its signature checks against Google's keys and it
 * is RS256, from Google, at most an hour old with 30 seconds' tolerance,
 * unexpired and for one of the audiences (the checks of better-auth's Google
 * provider). None when the token is not good; a failure that is not the
 * token's, such as fetching the keys, is thrown.
 */
async function verifiedClaims(
  idToken: string,
  keys: ReturnType<typeof googleKeys>,
  audience: readonly string[],
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(idToken, await keys.get(), {
      algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: [...audience],
      maxTokenAge: '1h',
      clockTolerance: 30,
    });
    return payload;
  } catch (error) {
    if (BAD_TOKEN_ERRORS.some((bad) => error instanceof bad)) return null;
    throw error;
  }
}

/**
 * The Google verifier: it checks the token's signature against Google's
 * published keys, which it keeps for as long as Google says, its issuer, its
 * age and expiry and its audience against SLOVO's client ids. With no client
 * id, no token is for SLOVO, so every one is refused as not configured. When
 * Google's keys can't be fetched, it fails: that is no fault of the token.
 */
export function createGoogleVerifier({
  clientIds,
  fetch = globalThis.fetch,
}: {
  readonly clientIds: readonly string[];
  /** How Google's keys are fetched; the global `fetch` unless given. */
  readonly fetch?: typeof globalThis.fetch;
}): GoogleVerifier {
  const keys = googleKeys(fetch);
  return {
    async verify(idToken) {
      if (clientIds.length === 0) return { ok: false, reason: 'not-configured' };
      const claims = await verifiedClaims(idToken, keys, clientIds);
      if (claims === null) {
        const audience = unverifiedAudience(idToken);
        const foreign = audience !== undefined && !audience.some((aud) => clientIds.includes(aud));
        return { ok: false, reason: foreign ? 'foreign-audience' : 'invalid-token' };
      }
      const { sub, email, email_verified } = claims;
      if (typeof sub !== 'string' || typeof email !== 'string') {
        return { ok: false, reason: 'invalid-token' };
      }
      return {
        ok: true,
        identity: { subject: sub, email, emailVerified: email_verified === true },
      };
    },
  };
}
