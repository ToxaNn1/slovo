import { ORPCError, os } from '@orpc/server';
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
