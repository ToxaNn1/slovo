import type { ApiClient } from '@slovo/contracts/api';
import type { AccountApi, AccountApiFailure } from '@slovo/core';

import { answerOf } from '../api';

const unauthorized = { ok: false, reason: 'unauthorized' } as const;

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
  /** Calls a procedure of the Session's Account that answers nothing but success, such as a sign-out. */
  async function actWithSession(
    token: string,
    call: (account: ApiClient['account']) => ReturnType<ApiClient['account']['signOut']>,
  ): Promise<{ readonly ok: true } | AccountApiFailure> {
    const answer = await answerOf(call(clientOf(token).account), ({ code }) =>
      code === 'UNAUTHORIZED' ? unauthorized : undefined,
    );
    return answer.ok ? { ok: true } : answer;
  }

  return {
    async requestCode(email) {
      const answer = await answerOf(client.account.requestCode({ email, editionId }));
      return answer.ok ? { ok: true } : answer;
    },
    async verifyCode(email, code) {
      const answer = await answerOf(client.account.verifyCode({ email, code }), (error) => {
        if (error.code === 'WRONG_CODE') {
          return { ok: false, reason: 'wrong-code', triesLeft: error.data.triesLeft } as const;
        }
        if (error.code === 'CODE_EXPIRED') return { ok: false, reason: 'code-expired' } as const;
        return undefined;
      });
      if (!answer.ok) return answer;
      return { ok: true, token: answer.output.token, email: answer.output.email };
    },
    async me(token) {
      const answer = await answerOf(clientOf(token).account.me(), ({ code }) =>
        code === 'UNAUTHORIZED' ? unauthorized : undefined,
      );
      return answer.ok ? { ok: true, email: answer.output.email } : answer;
    },
    signOut: (token) => actWithSession(token, (account) => account.signOut()),
    signOutEverywhere: (token) => actWithSession(token, (account) => account.signOutEverywhere()),
    delete: (token) => actWithSession(token, (account) => account.delete()),
  };
}
