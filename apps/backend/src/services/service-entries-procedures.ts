import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { AdminSignIn, EntryRead, EntryWriteResult, ServiceEntries } from '@slovo/server-core';

import { personOf, type Caller } from '../admin/admission';

/** The answer of an entry write, or the refusal the contract lists. */
function done<Done>(
  result: EntryWriteResult<Done>,
  errors: { NOT_FOUND: () => Error; VAULT_OFF: () => Error },
): Done {
  if (result.ok) return result;
  throw result.reason === 'vault-off' ? errors.VAULT_OFF() : errors.NOT_FOUND();
}

/** The Service entry procedures of «Сервіси»: a Власник only, no read with a sealed value. */
export function serviceEntriesProcedures({
  entries,
  signIn,
}: {
  readonly entries: ServiceEntries;
  readonly signIn: Pick<AdminSignIn, 'confirmTotp'>;
}) {
  const os = implement(apiContract.admin.services).$context<{ caller: Caller }>();

  /** The Власник calling, named for the Action log, and their admin session's token. */
  const ownerOf = (caller: Caller) => {
    const { email, token } = personOf(caller);
    return { who: { kind: 'admin-user', email } as const, session: token };
  };

  /** One entry's plain value inside the caller's window, or the refusal the contract lists. */
  async function readOf(
    id: string,
    how: EntryRead,
    caller: Caller,
    errors: { NOT_FOUND: () => Error; VAULT_OFF: () => Error; LOCKED: () => Error },
  ) {
    const { who, session } = ownerOf(caller);
    const read = await entries.read(id, how, session, who);
    if (read.ok) return { value: read.value };
    if (read.reason === 'locked') throw errors.LOCKED();
    throw read.reason === 'vault-off' ? errors.VAULT_OFF() : errors.NOT_FOUND();
  }

  return {
    entries: os.entries.handler(async ({ input, errors }) => {
      const list = await entries.list(input.serviceId);
      if (list === undefined) throw errors.NOT_FOUND();
      return { vault: entries.vault, entries: [...list] };
    }),
    addEntry: os.addEntry.handler(async ({ context, input, errors }) => {
      const { who } = ownerOf(context.caller);
      const { reason, ...entry } = input;
      const { entry: added } = done(await entries.add(entry, { who, reason }), errors);
      return { entry: added };
    }),
    editEntry: os.editEntry.handler(async ({ context, input, errors }) => {
      const { who } = ownerOf(context.caller);
      const { id, reason, ...changes } = input;
      const { entry } = done(await entries.edit(id, changes, { who, reason }), errors);
      return { entry };
    }),
    deleteEntry: os.deleteEntry.handler(async ({ context, input, errors }) => {
      const { who } = ownerOf(context.caller);
      done(await entries.remove(input.id, { who, reason: input.reason }), errors);
      return { deleted: true as const };
    }),
    unlockVault: os.unlockVault.handler(async ({ context, input, errors }) => {
      const { who, session } = ownerOf(context.caller);
      if (entries.vault === 'off') throw errors.VAULT_OFF();
      const confirmed = await signIn.confirmTotp(who.email, input.code);
      if (!confirmed.ok) {
        throw confirmed.reason === 'wrong-code'
          ? errors.WRONG_CODE({ data: { attemptsLeft: confirmed.attemptsLeft } })
          : errors.TOO_MANY_REQUESTS({
              data: { retryAfterSeconds: confirmed.retryAfterSeconds },
            });
      }
      return { openUntil: entries.unlock(session).openUntil.toISOString() };
    }),
    revealEntry: os.revealEntry.handler(({ context, input, errors }) =>
      readOf(input.id, 'reveal', context.caller, errors),
    ),
    copyEntry: os.copyEntry.handler(({ context, input, errors }) =>
      readOf(input.id, 'copy', context.caller, errors),
    ),
  };
}
