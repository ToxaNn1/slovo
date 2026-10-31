import type { Clock } from '@slovo/server-core';
import {
  createRemoteJWKSet,
  customFetch,
  errors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyOptions,
} from 'jose';

/** How long the keys are kept when the provider's answer doesn't say. */
const DEFAULT_KEYS_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * What a token that is not a good identity token for SLOVO fails with: it is
 * no JWT, its algorithm is not the provider's, no key of the provider's
 * matches it, its signature doesn't check, it has expired, or a claim is
 * wrong. Any other failure, such as fetching the provider's keys, is not the
 * token's fault.
 */
const BAD_TOKEN_ERRORS = [
  errors.JWSInvalid,
  errors.JWTInvalid,
  errors.JWTClaimValidationFailed,
  errors.JWTExpired,
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
 * The keys a provider (Google, Apple) signs identity tokens with, fetched from
 * `url` when first needed and kept for as long as the provider's answer says,
 * then fetched again. A token signed with a key not among them fetches them
 * again too, at most every 30 seconds (jose's cooldown), for a key the
 * provider has published since.
 */
export function publishedKeys(url: URL, fetch: typeof globalThis.fetch, clock: Clock) {
  let expiresAt = 0;
  const keys = createRemoteJWKSet(url, {
    // Kept until the provider's max-age, which `get` checks, not jose's own.
    cacheMaxAge: Number.POSITIVE_INFINITY,
    [customFetch]: async (url, init) => {
      const response = await fetch(url, init);
      if (response.ok) expiresAt = clock.now().getTime() + maxAgeOf(response);
      return response;
    },
  });
  return {
    async get() {
      if (keys.fresh && clock.now().getTime() >= expiresAt) await keys.reload();
      return keys;
    },
  };
}

export type PublishedKeys = ReturnType<typeof publishedKeys>;

/**
 * The token's claims once its signature checks against the provider's keys
 * and it is RS256, from the issuer, unexpired by the clock with 30 seconds'
 * tolerance and for the audience, with any further check of `options`. When
 * the token is not good, why: for another app when only its checked audience
 * is wrong, else invalid. A failure that is not the token's, such as fetching
 * the keys, is thrown.
 */
export async function verifiedClaims(
  idToken: string,
  keys: PublishedKeys,
  options: Pick<JWTVerifyOptions, 'issuer' | 'audience' | 'maxTokenAge'>,
  clock: Clock,
): Promise<JWTPayload | 'foreign-audience' | 'invalid-token'> {
  try {
    const { payload } = await jwtVerify(idToken, await keys.get(), {
      ...options,
      algorithms: ['RS256'],
      clockTolerance: 30,
      currentDate: clock.now(),
    });
    return payload;
  } catch (error) {
    if (error instanceof errors.JWTClaimValidationFailed && error.claim === 'aud') {
      return 'foreign-audience';
    }
    if (BAD_TOKEN_ERRORS.some((bad) => error instanceof bad)) return 'invalid-token';
    throw error;
  }
}
