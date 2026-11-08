import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { AdminAccess } from '@slovo/server-core';

/** The bearer token of the request's `Authorization` header, if it carries one. */
function bearerOf(headers: Headers): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(headers.get('authorization') ?? '');
  return match?.[1];
}

/** Who calls an admin procedure: no one known yet (the sign-in ticket adds the Admin user), or an Агент. */
export type AdminCaller =
  { readonly kind: 'anonymous' } | { readonly kind: 'agent'; readonly name: string };

/**
 * The admin API (ADR 0088). Every procedure answers 404 while no Власник
 * exists. A procedure declares whether it writes content: only those take
 * an Агент token; every other one refuses it.
 */
export function adminProcedures(admin: AdminAccess) {
  const os = implement(apiContract.admin).$context<{ headers: Headers }>();

  /** Admits the caller to a procedure, or throws the refusal the contract lists. */
  async function admit(
    headers: Headers,
    errors: { NOT_FOUND: () => Error; UNAUTHORIZED: () => Error; FORBIDDEN: () => Error },
    { writesContent }: { writesContent: boolean },
  ): Promise<AdminCaller> {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    const token = bearerOf(headers);
    if (token === undefined) return { kind: 'anonymous' };
    const name = await admin.agentOf(token);
    if (name === undefined) throw errors.UNAUTHORIZED();
    if (!writesContent) throw errors.FORBIDDEN();
    return { kind: 'agent', name };
  }

  return os.router({
    status: os.status.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { writesContent: false });
      return { on: true as const };
    }),
  });
}
