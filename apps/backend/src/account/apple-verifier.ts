import type { AppleVerifier, Clock } from '@slovo/server-core';

import { publishedKeys, verifiedClaims } from './identity-token-keys';

/** Where Apple publishes the keys it signs identity tokens with. */
const APPLE_KEYS_URL = new URL('https://appleid.apple.com/auth/keys');

/** Who issues Apple identity tokens. */
const APPLE_ISSUER = 'https://appleid.apple.com';

/**
 * The Apple verifier (ADR 0047): it checks the token's signature against
 * Apple's published keys, which it keeps for as long as Apple says, its
 * issuer, its expiry and its audience against the app's bundle id, which
 * is SLOVO's client id at Apple. The email claim is the Account's email, a
 * private relay address included. When Apple's keys can't be fetched, it
 * fails: that is no fault of the token.
 */
export function createAppleVerifier({
  fetch = globalThis.fetch,
  clock,
}: {
  /** How Apple's keys are fetched; the global `fetch` unless given. */
  readonly fetch?: typeof globalThis.fetch;
  /** The time the keys expire by and the token's expiry is checked at. */
  readonly clock: Clock;
}): AppleVerifier {
  const keys = publishedKeys(APPLE_KEYS_URL, fetch, clock);
  return {
    async verify(idToken, bundleId) {
      const claims = await verifiedClaims(
        idToken,
        keys,
        { issuer: APPLE_ISSUER, audience: bundleId },
        clock,
      );
      if (typeof claims === 'string') return { ok: false, reason: claims };
      const { sub, email } = claims;
      if (typeof sub !== 'string' || typeof email !== 'string') {
        return { ok: false, reason: 'invalid-token' };
      }
      return { ok: true, identity: { subject: sub, email } };
    },
  };
}
