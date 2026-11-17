import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Actor, EntryWriteResult, ServiceEntries } from '@slovo/server-core';

/** The refusals an entry procedure may answer. */
interface EntryErrors {
  NOT_FOUND: () => Error;
  UNAUTHORIZED: () => Error;
  FORBIDDEN: () => Error;
}

/** What the entry procedures take: the entries, and who a Власник's write is by. */
export interface EntryAccess {
  readonly entries: ServiceEntries;
  /** Admits a Власник alone, the write header with a write, and names them for the Action log. */
  readonly ownerOf: (
    headers: Headers,
    errors: EntryErrors,
    needs?: { readonly writes?: boolean },
  ) => Promise<Actor>;
}

/** The answer of an entry write, or the refusal the contract lists. */
function done<Done>(
  result: EntryWriteResult<Done>,
  errors: { NOT_FOUND: () => Error; VAULT_OFF: () => Error },
): Done {
  if (result.ok) return result;
  throw result.reason === 'vault-off' ? errors.VAULT_OFF() : errors.NOT_FOUND();
}

/** The Service entry procedures of «Сервіси» (ADR 0164): a Власник only, no read with a sealed value. */
export function serviceEntriesProcedures({ entries, ownerOf }: EntryAccess) {
  const os = implement(apiContract.admin.services).$context<{ headers: Headers }>();
  return {
    entries: os.entries.handler(async ({ context, input, errors }) => {
      await ownerOf(context.headers, errors);
      const list = await entries.list(input.serviceId);
      if (list === undefined) throw errors.NOT_FOUND();
      return { vault: entries.vault, entries: [...list] };
    }),
    addEntry: os.addEntry.handler(async ({ context, input, errors }) => {
      const who = await ownerOf(context.headers, errors, { writes: true });
      const { reason, ...entry } = input;
      const { entry: added } = done(await entries.add(entry, { who, reason }), errors);
      return { entry: added };
    }),
    editEntry: os.editEntry.handler(async ({ context, input, errors }) => {
      const who = await ownerOf(context.headers, errors, { writes: true });
      const { id, reason, ...changes } = input;
      const { entry } = done(await entries.edit(id, changes, { who, reason }), errors);
      return { entry };
    }),
    deleteEntry: os.deleteEntry.handler(async ({ context, input, errors }) => {
      const who = await ownerOf(context.headers, errors, { writes: true });
      done(await entries.remove(input.id, { who, reason: input.reason }), errors);
      return { deleted: true as const };
    }),
  };
}
