import { implement, ORPCError, os } from '@orpc/server';
import type { Accounts } from '@slovo/server-core';

/** The token of the request's `Authorization: Bearer <token>`, if any. */
function bearerToken(headers: Headers): string | undefined {
  const [scheme, token] = headers.get('authorization')?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * The one way a procedure of a Session reaches its Account (ADR 0030): it
 * puts the Session the request's token carries in the context, or refuses
 * the request as UNAUTHORIZED, the one place that does.
 */
export function sessionGate(accounts: Accounts) {
  return os.$context<{ readonly headers: Headers }>().middleware(async ({ context, next }) => {
    const opened = await accounts.session(bearerToken(context.headers));
    if (!opened.ok) throw new ORPCError('UNAUTHORIZED');
    return next({ context: { session: opened.session } });
  });
}

/**
 * The router of a contract whose procedures a Session gates: the gate runs
 * before the input is read, as oRPC validates the input before the
 * middlewares a procedure adds unless told otherwise.
 */
export function signedInRouter<T extends Parameters<typeof implement>[0]>(contract: T) {
  return implement(contract, { initialInputValidationIndex: Number.POSITIVE_INFINITY });
}
