import type { AppleRevocation, AppleRevoker, Clock } from '@slovo/server-core';
import { importPKCS8, SignJWT, type CryptoKey } from 'jose';
import { z } from 'zod';

/** Where Apple's token and revoke endpoints are, and the audience of a client secret. */
const APPLE = 'https://appleid.apple.com';

/** How long a client secret holds, in seconds: one deletion's two requests need a few. */
const CLIENT_SECRET_SECONDS = 300;

/**
 * SLOVO's Sign in with Apple key, as the owner creates it in the Apple
 * Developer portal: the team's id, the key's id and its private key.
 */
export interface AppleKey {
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: CryptoKey;
}

/**
 * Imports the key from the environment's values once, at start: the .p8
 * file's contents, whose line breaks a host's form may have turned into `\n`.
 */
export async function importAppleKey({
  teamId,
  keyId,
  privateKey,
}: {
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: string;
}): Promise<AppleKey> {
  const pem = privateKey.replaceAll('\\n', '\n');
  return { teamId, keyId, privateKey: await importPKCS8(pem, 'ES256') };
}

/** A failure of the revocation that names the step and Apple's answer, and no code or token. */
const failed = (message: string): AppleRevocation => ({
  ok: false,
  reason: 'failed',
  error: Object.assign(new Error(message), { name: 'AppleRevocationError' }),
});

/** Apple's answer to a refused request: its own error code, such as `invalid_grant`. */
const AppleErrorSchema = z.object({ error: z.string().regex(/^[a-z_]{1,40}$/) });

/** Apple's answer to a code exchanged: the tokens it hands out. */
const AppleTokensSchema = z.object({
  refresh_token: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
});

/** Apple's error code of a refused request, after a space, when its answer names one. */
async function appleErrorOf(response: Response): Promise<string> {
  const body = AppleErrorSchema.safeParse(await response.json().catch(() => undefined));
  return body.success ? ` ${body.data.error}` : '';
}

/**
 * The Apple revoker (App Store Review Guideline 5.1.1(v)): with SLOVO's
 * Sign in with Apple key it signs a client secret (ES256, the team as its
 * issuer, the bundle id as its subject, Apple as its audience, for five
 * minutes), exchanges the authorization code for Apple's tokens at
 * `/auth/token` and revokes the refresh token, or the access token when
 * Apple hands out none, at `/auth/revoke`. It keeps neither. Without a key
 * it asks Apple nothing.
 */
export function createAppleRevoker({
  key,
  fetch = globalThis.fetch,
  clock,
}: {
  /** SLOVO's Sign in with Apple key; none while the environment lacks it. */
  readonly key: AppleKey | undefined;
  /** How Apple is reached; the global `fetch` unless given. */
  readonly fetch?: typeof globalThis.fetch;
  /** The time the client secret is issued at. */
  readonly clock: Clock;
}): AppleRevoker {
  /** Posts the form to Apple's endpoint, or answers why it could not. */
  async function post(
    endpoint: 'token' | 'revoke',
    form: Record<string, string>,
  ): Promise<Response | AppleRevocation> {
    try {
      return await fetch(`${APPLE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form).toString(),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'NonError';
      return failed(`Apple's ${endpoint} endpoint could not be reached: ${name}`);
    }
  }

  return {
    async revoke(code, bundleId) {
      if (key === undefined) return { ok: false, reason: 'not-configured' };
      const issuedAt = Math.floor(clock.now().getTime() / 1000);
      const clientSecret = await new SignJWT({})
        .setProtectedHeader({ alg: 'ES256', kid: key.keyId })
        .setIssuer(key.teamId)
        .setSubject(bundleId)
        .setAudience(APPLE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + CLIENT_SECRET_SECONDS)
        .sign(key.privateKey);
      const client = { client_id: bundleId, client_secret: clientSecret };

      const exchanged = await post('token', {
        ...client,
        code,
        grant_type: 'authorization_code',
      });
      if (!(exchanged instanceof Response)) return exchanged;
      if (!exchanged.ok) {
        return failed(
          `Apple's token endpoint answered ${String(exchanged.status)}${await appleErrorOf(exchanged)}`,
        );
      }
      const tokens = AppleTokensSchema.safeParse(await exchanged.json().catch(() => undefined));
      const { refresh_token: refresh, access_token: access } = tokens.success ? tokens.data : {};
      const revoked =
        refresh !== undefined
          ? { token: refresh, token_type_hint: 'refresh_token' }
          : access !== undefined
            ? { token: access, token_type_hint: 'access_token' }
            : undefined;
      if (revoked === undefined) return failed("Apple's token endpoint answered no token");

      const answer = await post('revoke', { ...client, ...revoked });
      if (!(answer instanceof Response)) return answer;
      if (!answer.ok) {
        return failed(
          `Apple's revoke endpoint answered ${String(answer.status)}${await appleErrorOf(answer)}`,
        );
      }
      return { ok: true };
    },
  };
}
