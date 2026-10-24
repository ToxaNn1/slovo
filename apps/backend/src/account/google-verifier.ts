import type { GoogleVerifier } from '@slovo/server-core';
import { verifyGoogleIdToken } from 'better-auth/social-providers';

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
 * The Google verifier on better-auth's Google provider: it checks the token's
 * signature against Google's published keys, its issuer, its expiry and its
 * audience against SLOVO's client ids. With no client id, no token is for
 * SLOVO, so every one is refused as not configured.
 */
export function createGoogleVerifier({
  clientIds,
}: {
  readonly clientIds: readonly string[];
}): GoogleVerifier {
  return {
    async verify(idToken) {
      if (clientIds.length === 0) return { ok: false, reason: 'not-configured' };
      const claims = await verifyGoogleIdToken({ token: idToken, audience: [...clientIds] });
      if (claims === null) {
        const audience = unverifiedAudience(idToken);
        const foreign = audience !== undefined && !audience.some((aud) => clientIds.includes(aud));
        return { ok: false, reason: foreign ? 'foreign-audience' : 'invalid-token' };
      }
      const { sub, email, email_verified } = claims as {
        sub?: unknown;
        email?: unknown;
        email_verified?: unknown;
      };
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
