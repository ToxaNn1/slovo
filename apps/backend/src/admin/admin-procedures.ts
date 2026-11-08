import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type {
  Actor,
  AdminAccess,
  EditionRegistry,
  EditionSwitches,
  SwitchRefusal,
  SwitchRefused,
} from '@slovo/server-core';

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
export function adminProcedures(admin: AdminAccess, editions: EditionRegistry) {
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

  /**
   * Who the Action log names for a caller of a switch write: an Агент never
   * gets here; until the sign-in names the Admin user, the caller is anonymous.
   */
  const actorOf = (caller: AdminCaller): Actor =>
    caller.kind === 'agent' ? { kind: 'agent', name: caller.name } : { kind: 'anonymous' };

  /** The answer of a switch write, or the refusal by name the contract lists. */
  function answered(
    result: EditionSwitches | SwitchRefused,
    errors: {
      BAD_REQUEST: (options: { data: { refusal: SwitchRefusal; feature: string } }) => Error;
    },
  ) {
    if (!result.ok) {
      throw errors.BAD_REQUEST({ data: { refusal: result.reason, feature: result.feature } });
    }
    return { rules: [...result.rules], minimums: result.minimums };
  }

  return os.router({
    status: os.status.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { writesContent: false });
      return { on: true as const };
    }),

    switches: os.switches.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors, { writesContent: false });
      const switches = await editions.switches(input.editionId);
      if (!switches.ok) throw errors.NOT_FOUND();
      return { rules: [...switches.rules], minimums: switches.minimums };
    }),

    setRules: os.setRules.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writesContent: false });
      const result = await editions.setRules(input.editionId, input.feature, input.rules, {
        who: actorOf(caller),
        reason: input.reason,
      });
      return answered(result, errors);
    }),

    setMinimum: os.setMinimum.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writesContent: false });
      const result = await editions.setMinimum(input.editionId, input.platform, input.minimum, {
        who: actorOf(caller),
        reason: input.reason,
      });
      return answered(result, errors);
    }),

    kill: os.kill.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writesContent: false });
      const result = await editions.kill(input.feature, input.editionId, {
        who: actorOf(caller),
        reason: input.reason,
      });
      if (!result.ok) {
        throw errors.BAD_REQUEST({ data: { refusal: result.reason, feature: result.feature } });
      }
      return { editionIds: [...result.editionIds] };
    }),
  });
}
