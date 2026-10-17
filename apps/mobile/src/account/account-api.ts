import { ORPCError, type ApiClient } from '@slovo/contracts/api';
import type { AccountApi, AccountApiFailure } from '@slovo/core';

import { requestFailure } from '../api';

/** A failure of an Account procedure: the Session ended (401), or one any call may end in. */
function accountFailure(error: unknown): AccountApiFailure {
  if (error instanceof ORPCError && error.status === 401) {
    return { ok: false, reason: 'unauthorized' };
  }
  return requestFailure(error);
}

/** The tries a wrong code has left, as the backend's `WRONG_CODE` carries them. */
function triesLeftOf(data: unknown): number | undefined {
  if (typeof data !== 'object' || data === null || !('triesLeft' in data)) return undefined;
  return typeof data.triesLeft === 'number' ? data.triesLeft : undefined;
}

/**
 * The Core's `AccountApi` on the API contract's client. The Sign-in code
 * request names the running Edition, so the email is in its language; the
 * calls that act on an Account go through the client of its Session, which
 * sends the token as `Authorization: Bearer`.
 */
export function createAccountApi({
  client,
  clientOf,
  editionId,
}: {
  client: Pick<ApiClient, 'account'>;
  /** The client of a device signed in with the Session's token. */
  clientOf: (token: string) => Pick<ApiClient, 'account'>;
  editionId: string;
}): AccountApi {
  /** Calls a procedure that acts on the Session's Account and ends nothing but a Session or an Account. */
  async function withSession(
    token: string,
    call: (account: ApiClient['account']) => Promise<unknown>,
  ): Promise<{ readonly ok: true } | AccountApiFailure> {
    try {
      await call(clientOf(token).account);
      return { ok: true };
    } catch (error) {
      return accountFailure(error);
    }
  }

  return {
    async requestCode(email) {
      try {
        await client.account.requestCode({ email, editionId });
        return { ok: true };
      } catch (error) {
        return requestFailure(error);
      }
    },
    async verifyCode(email, code) {
      try {
        const session = await client.account.verifyCode({ email, code });
        return { ok: true, token: session.token, email: session.email };
      } catch (error) {
        if (error instanceof ORPCError && error.code === 'CODE_EXPIRED') {
          return { ok: false, reason: 'code-expired' };
        }
        const triesLeft =
          error instanceof ORPCError && error.code === 'WRONG_CODE'
            ? triesLeftOf(error.data)
            : undefined;
        if (triesLeft !== undefined) return { ok: false, reason: 'wrong-code', triesLeft };
        return requestFailure(error);
      }
    },
    async me(token) {
      try {
        const { email } = await clientOf(token).account.me();
        return { ok: true, email };
      } catch (error) {
        return accountFailure(error);
      }
    },
    signOut: (token) => withSession(token, (account) => account.signOut()),
    signOutEverywhere: (token) => withSession(token, (account) => account.signOutEverywhere()),
    delete: (token) => withSession(token, (account) => account.delete()),
  };
}
