import { implement, ORPCError } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Accounts } from '@slovo/server-core';

/** What a request brings to the Account procedures. */
interface AccountContext {
  readonly headers: Headers;
}

/** The token of the request's `Authorization: Bearer <token>`, if any. */
function bearerToken(headers: Headers): string | undefined {
  const [scheme, token] = headers.get('authorization')?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/** The Account procedures of the contract, over the server Core's Accounts. */
export function accountProcedures(accounts: Accounts) {
  const account = implement(apiContract.account).$context<AccountContext>();

  // Puts the Account of the request's Session in the context, or refuses the
  // request as UNAUTHORIZED.
  const signedIn = account.middleware(async ({ context, next }) => {
    const token = bearerToken(context.headers);
    const session = token === undefined ? undefined : await accounts.session(token);
    if (session === undefined) throw new ORPCError('UNAUTHORIZED');
    return next({ context: { account: session } });
  });

  return account.router({
    requestCode: account.requestCode.handler(async ({ input, errors }) => {
      const sent = await accounts.requestCode(input.email, input.editionId);
      if (sent.ok) return {};
      if (sent.reason === 'invalid-email') throw errors.BAD_REQUEST();
      throw errors.NOT_FOUND();
    }),

    verifyCode: account.verifyCode.handler(async ({ input, errors }) => {
      const check = await accounts.verifyCode(input.email, input.code);
      if (check.ok) return { token: check.token, email: check.account.email };
      switch (check.reason) {
        case 'invalid-email':
          throw errors.BAD_REQUEST();
        case 'wrong-code':
          throw errors.WRONG_CODE({ data: { triesLeft: check.triesLeft } });
        case 'code-expired':
          throw errors.CODE_EXPIRED();
        case 'too-many-tries':
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    me: account.me.use(signedIn).handler(({ context }) => ({
      email: context.account.email,
      createdAt: context.account.createdAt.toISOString(),
    })),
  });
}
