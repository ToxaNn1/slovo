import type { Clock, GoogleVerifier } from '@slovo/server-core';

import { publishedKeys, verifiedClaims } from './identity-token-keys';

/** Where Google publishes the keys it signs identity tokens with. */
const GOOGLE_KEYS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

/**
 * The Google verifier: it checks the token's signature against Google's
 * published keys, which it keeps for as long as Google says, its issuer, its
 * age (at most an hour, as better-auth's Google provider checks) and expiry
 * and its audience against SLOVO's client ids. With no client id, no token is
 * for SLOVO, so every one is refused as not configured. When Google's keys
 * can't be fetched, it fails: that is no fault of the token.
 */
export function createGoogleVerifier({
  clientIds,
  fetch = globalThis.fetch,
  clock,
}: {
  readonly clientIds: readonly string[];
  /** How Google's keys are fetched; the global `fetch` unless given. */
  readonly fetch?: typeof globalThis.fetch;
  /** The time the keys expire by and the token's age and expiry are checked at. */
  readonly clock: Clock;
}): GoogleVerifier {
  const keys = publishedKeys(GOOGLE_KEYS_URL, fetch, clock);
  return {
    async verify(idToken) {
      if (clientIds.length === 0) return { ok: false, reason: 'not-configured' };
      const claims = await verifiedClaims(
        idToken,
        keys,
        {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          audience: [...clientIds],
          maxTokenAge: '1h',
        },
        clock,
      );
      if (typeof claims === 'string') return { ok: false, reason: claims };
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
