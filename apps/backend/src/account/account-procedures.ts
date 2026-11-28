import { apiContract } from '@slovo/contracts/api';
import type { Accounts, AppleRevocation } from '@slovo/server-core';
import type { Logger } from 'pino';

import { reportOf, type ErrorReporter } from '../error-reporter';
import { retryAfter } from '../retry-after';
import { sessionGate, signedInRouter } from './session-gate';

/** What a request brings to the Account procedures. */
interface AccountContext {
  readonly headers: Headers;
  /** The IP address of the request's connection, which the sign-in limits count. */
  readonly ip: string;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
  /** The request's logger, which carries its request id. */
  readonly logger: Logger;
  readonly requestId: string;
  /** Where a failed Apple revocation is reported. */
  readonly reporter: ErrorReporter;
}

/**
 * Tells of an Apple revocation that did not happen, which held back no
 * deletion: a warning without a Sign in with Apple key, and a report to
 * Sentry of Apple's failure, naming no code, token or Account.
 */
function tellRevocation(revocation: AppleRevocation | undefined, context: AccountContext): void {
  if (revocation === undefined || revocation.ok) return;
  if (revocation.reason === 'not-configured') {
    context.logger.warn('the Apple revocation was skipped: no Sign in with Apple key');
    return;
  }
  context.logger.warn({ err: revocation.error }, 'the Apple revocation failed');
  context.reporter.report(reportOf(revocation.error, context.requestId));
}

/** The Account procedures of the contract, over the server Core's Accounts. */
export function accountProcedures(accounts: Accounts) {
  const account = signedInRouter(apiContract.account).$context<AccountContext>();

  const signedIn = sessionGate(accounts);

  return account.router({
    requestCode: account.requestCode.handler(async ({ input, context, errors }) => {
      const sent = await accounts.requestCode(input.email, input.editionId, context.ip);
      if (sent.ok) return {};
      switch (sent.reason) {
        case 'invalid-email':
          throw errors.BAD_REQUEST();
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, sent);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    verifyCode: account.verifyCode.handler(async ({ input, context, errors }) => {
      const check = await accounts.verifyCode(input.email, input.code, context.ip);
      if (check.ok) return { token: check.token, email: check.account.email };
      switch (check.reason) {
        case 'invalid-email':
          throw errors.BAD_REQUEST();
        case 'wrong-code':
          throw errors.WRONG_CODE({ data: { triesLeft: check.triesLeft } });
        // A code whose Edition no longer serves the Account signs no one in,
        // as an expired one; a new code request answers NOT_FOUND.
        case 'code-expired':
        case 'unknown-edition':
        case 'switched-off':
          throw errors.CODE_EXPIRED();
        case 'too-many-requests':
          retryAfter(context, check);
          throw errors.TOO_MANY_REQUESTS();
        // A spent code passes with no time, so the answer has no Retry-After.
        case 'too-many-tries':
          throw errors.CODE_SPENT();
      }
    }),

    signInWithGoogle: account.signInWithGoogle.handler(async ({ input, context, errors }) => {
      const check = await accounts.signInWithGoogle(input.idToken, input.editionId, context.ip);
      if (check.ok) return { token: check.token, email: check.account.email };
      switch (check.reason) {
        case 'invalid-token':
          throw errors.INVALID_TOKEN();
        case 'foreign-audience':
          throw errors.FOREIGN_AUDIENCE();
        case 'unverified-email':
          throw errors.EMAIL_NOT_VERIFIED();
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, check);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    signInWithApple: account.signInWithApple.handler(async ({ input, context, errors }) => {
      const check = await accounts.signInWithApple(input.idToken, input.editionId, context.ip);
      if (check.ok) return { token: check.token, email: check.account.email };
      switch (check.reason) {
        case 'invalid-token':
          throw errors.INVALID_TOKEN();
        case 'foreign-audience':
          throw errors.FOREIGN_AUDIENCE();
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, check);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    me: account.me.use(signedIn).handler(async ({ context: { session } }) => ({
      email: session.account.email,
      createdAt: session.account.createdAt.toISOString(),
      signInMethods: [...(await accounts.signInMethodsOf(session))],
    })),

    signOut: account.signOut.use(signedIn).handler(async ({ context }) => {
      await accounts.signOut(context.session);
      return {};
    }),

    signOutEverywhere: account.signOutEverywhere.use(signedIn).handler(async ({ context }) => {
      await accounts.signOutEverywhere(context.session);
      return {};
    }),

    delete: account.delete.use(signedIn).handler(async ({ input, context }) => {
      tellRevocation(
        await accounts.delete(context.session, input?.appleAuthorizationCode),
        context,
      );
      return {};
    }),
  });
}
