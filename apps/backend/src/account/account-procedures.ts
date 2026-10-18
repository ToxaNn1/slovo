import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Accounts } from '@slovo/server-core';

import { retryAfter } from '../retry-after';
import { sessionGate } from './session-gate';

/** What a request brings to the Account procedures. */
interface AccountContext {
  readonly headers: Headers;
  /** The IP address of the request's connection, which the sign-in limits count. */
  readonly ip: string;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/** The Account procedures of the contract, over the server Core's Accounts. */
export function accountProcedures(accounts: Accounts) {
  const account = implement(apiContract.account).$context<AccountContext>();

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
        case 'code-expired':
          throw errors.CODE_EXPIRED();
        case 'too-many-requests':
          retryAfter(context, check);
          throw errors.TOO_MANY_REQUESTS();
        // A spent code passes with no time, so the answer has no Retry-After.
        case 'too-many-tries':
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    me: account.me.use(signedIn).handler(({ context: { session } }) => ({
      email: session.account.email,
      createdAt: session.account.createdAt.toISOString(),
    })),

    signOut: account.signOut.use(signedIn).handler(async ({ context }) => {
      await accounts.signOut(context.session);
      return {};
    }),

    signOutEverywhere: account.signOutEverywhere.use(signedIn).handler(async ({ context }) => {
      await accounts.signOutEverywhere(context.session);
      return {};
    }),

    delete: account.delete.use(signedIn).handler(async ({ context }) => {
      await accounts.delete(context.session);
      return {};
    }),
  });
}
