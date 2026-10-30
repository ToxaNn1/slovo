import { answerOf } from '../backend';
import type { Backend, RequestFailure } from '../ports';

/**
 * A request of the Account that failed as any request does, or because the
 * Session it carried has ended (401).
 */
export type AccountApiFailure =
  RequestFailure | { readonly ok: false; readonly reason: 'unauthorized' };

const unauthorized = { ok: false, reason: 'unauthorized' } as const;

/**
 * The Account's requests to the backend, each answered as a value (ADR 0064).
 * The Sign-in code request names the running Edition, so the email is in its
 * language, and the Google sign-in names it for its `googleSignIn` Feature
 * Switch; the requests that act on an Account carry the token of its Session.
 */
export function accountRequests(backend: Pick<Backend, 'account'>, editionId: string) {
  const { account } = backend;
  /** Calls a procedure of the Session's Account that answers nothing but success, such as a sign-out. */
  async function actWithSession(
    call: () => ReturnType<typeof account.signOut>,
  ): Promise<{ readonly ok: true } | AccountApiFailure> {
    const answer = await answerOf(call(), ({ code }) =>
      code === 'UNAUTHORIZED' ? unauthorized : undefined,
    );
    return answer.ok ? { ok: true } : answer;
  }

  return {
    /** Sends a Sign-in code to the email. The answer is the same whether or not the email has an Account. */
    async requestCode(email: string): Promise<{ readonly ok: true } | AccountApiFailure> {
      const answer = await answerOf(account.requestCode({ email, editionId }));
      return answer.ok ? { ok: true } : answer;
    },
    /**
     * Checks the code last sent to the email. The first right code creates
     * the Account; the answer is the new Session's token and the Account's email.
     */
    async verifyCode(
      email: string,
      code: string,
    ): Promise<
      | { readonly ok: true; readonly token: string; readonly email: string }
      | { readonly ok: false; readonly reason: 'wrong-code'; readonly triesLeft: number }
      | { readonly ok: false; readonly reason: 'code-expired' }
      | AccountApiFailure
    > {
      const answer = await answerOf(account.verifyCode({ email, code }), (error) => {
        if (error.code === 'WRONG_CODE') {
          return { ok: false, reason: 'wrong-code', triesLeft: error.data.triesLeft } as const;
        }
        if (error.code === 'CODE_EXPIRED') return { ok: false, reason: 'code-expired' } as const;
        return undefined;
      });
      if (!answer.ok) return answer;
      return { ok: true, token: answer.output.token, email: answer.output.email };
    },
    /**
     * Signs in with a Google identity token (ADR 0047); the answer is the
     * new Session's token and the Account's email. The backend refuses a
     * token that is not Google's, has expired, is for another app or names
     * an email Google hasn't verified; a backend that doesn't offer Google
     * sign-in (NOT_FOUND: the switch turned off remotely, or no Google
     * client ids) refuses it too, so the reader turns to the code.
     */
    async signInWithGoogle(
      idToken: string,
    ): Promise<
      | { readonly ok: true; readonly token: string; readonly email: string }
      | { readonly ok: false; readonly reason: 'refused' }
      | AccountApiFailure
    > {
      const answer = await answerOf(account.signInWithGoogle({ idToken, editionId }), ({ code }) =>
        code === 'INVALID_TOKEN' ||
        code === 'FOREIGN_AUDIENCE' ||
        code === 'EMAIL_NOT_VERIFIED' ||
        code === 'NOT_FOUND'
          ? ({ ok: false, reason: 'refused' } as const)
          : undefined,
      );
      if (!answer.ok) return answer;
      return { ok: true, token: answer.output.token, email: answer.output.email };
    },
    /** The email of the Session's Account. */
    async me(
      token: string,
    ): Promise<{ readonly ok: true; readonly email: string } | AccountApiFailure> {
      const answer = await answerOf(account.me(undefined, { context: { token } }), ({ code }) =>
        code === 'UNAUTHORIZED' ? unauthorized : undefined,
      );
      return answer.ok ? { ok: true, email: answer.output.email } : answer;
    },
    /** Ends the Session. */
    signOut: (token: string) =>
      actWithSession(() => account.signOut(undefined, { context: { token } })),
    /** Ends every Session of the Session's Account. */
    signOutEverywhere: (token: string) =>
      actWithSession(() => account.signOutEverywhere(undefined, { context: { token } })),
    /** Deletes the Session's Account with every Session of it, for good. */
    delete: (token: string) =>
      actWithSession(() => account.delete(undefined, { context: { token } })),
  };
}
