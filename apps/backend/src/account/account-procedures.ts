import { implement, ORPCError } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Accounts } from '@slovo/server-core';

/** What a request brings to the Account procedures. */
interface AccountContext {
  readonly headers: Headers;
  /** The IP address the request came from; none when it came on no connection. */
  readonly ip: string | undefined;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/** The IP address the sign-in limits count the request under. */
function ipOf({ ip }: AccountContext): string {
  if (ip === undefined) throw new Error('the request came on no connection');
  return ip;
}

/** Tells the answer when, in seconds, a request over a limit may come again. */
function retryAfter({ resHeaders }: AccountContext, seconds: number): void {
  resHeaders?.set('retry-after', String(seconds));
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
    const signedInAccount = token === undefined ? undefined : await accounts.accountOf(token);
    if (signedInAccount === undefined) throw new ORPCError('UNAUTHORIZED');
    return next({ context: { account: signedInAccount } });
  });

  // Puts the request's token in the context for the server Core, which finds
  // its Session, or refuses a request without one as UNAUTHORIZED.
  const withToken = account.middleware(async ({ context, next }) => {
    const token = bearerToken(context.headers);
    if (token === undefined) throw new ORPCError('UNAUTHORIZED');
    return next({ context: { token } });
  });

  /** The empty answer of a done action, or UNAUTHORIZED when the token carried no Session. */
  const answered = (done: { readonly ok: boolean }) => {
    if (!done.ok) throw new ORPCError('UNAUTHORIZED');
    return {};
  };

  return account.router({
    requestCode: account.requestCode.handler(async ({ input, context, errors }) => {
      const sent = await accounts.requestCode(input.email, input.editionId, ipOf(context));
      if (sent.ok) return {};
      switch (sent.reason) {
        case 'invalid-email':
          throw errors.BAD_REQUEST();
        case 'unknown-edition':
        case 'account-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, sent.retryAfterSeconds);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    verifyCode: account.verifyCode.handler(async ({ input, context, errors }) => {
      const check = await accounts.verifyCode(input.email, input.code, ipOf(context));
      if (check.ok) return { token: check.token, email: check.account.email };
      switch (check.reason) {
        case 'invalid-email':
          throw errors.BAD_REQUEST();
        case 'wrong-code':
          throw errors.WRONG_CODE({ data: { triesLeft: check.triesLeft } });
        case 'code-expired':
          throw errors.CODE_EXPIRED();
        case 'too-many-requests':
          retryAfter(context, check.retryAfterSeconds);
          throw errors.TOO_MANY_REQUESTS();
        // A spent code passes with no time, so the answer has no Retry-After.
        case 'too-many-tries':
          throw errors.TOO_MANY_REQUESTS();
      }
    }),

    me: account.me.use(signedIn).handler(({ context }) => ({
      email: context.account.email,
      createdAt: context.account.createdAt.toISOString(),
    })),

    signOut: account.signOut
      .use(withToken)
      .handler(async ({ context }) => answered(await accounts.signOut(context.token))),

    signOutEverywhere: account.signOutEverywhere
      .use(withToken)
      .handler(async ({ context }) => answered(await accounts.signOutEverywhere(context.token))),

    delete: account.delete
      .use(withToken)
      .handler(async ({ context }) => answered(await accounts.delete(context.token))),
  });
}
