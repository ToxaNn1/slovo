import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type {
  Actor,
  AdminSignIn,
  EntryRead,
  EntryWriteResult,
  ServiceEntries,
} from '@slovo/server-core';

/** The refusals an entry procedure may answer. */
interface EntryErrors {
  NOT_FOUND: () => Error;
  UNAUTHORIZED: () => Error;
  FORBIDDEN: () => Error;
}

/** A Власник calling by their admin session. */
export interface EntryOwner {
  /** Who the Action log names. */
  readonly who: Extract<Actor, { kind: 'admin-user' }>;
  /** The admin session's token, the one a Vault unlock opens. */
  readonly session: string;
}

/** What the entry procedures take: the entries, who a Власник's write is by, and the TOTP check. */
export interface EntryAccess {
  readonly entries: ServiceEntries;
  /** Admits a Власник alone, the write header with a write, and names them for the Action log. */
  readonly ownerOf: (
    headers: Headers,
    errors: EntryErrors,
    needs?: { readonly writes?: boolean },
  ) => Promise<EntryOwner>;
  readonly signIn: Pick<AdminSignIn, 'confirmTotp'>;
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
export function serviceEntriesProcedures({ entries, ownerOf, signIn }: EntryAccess) {
  const os = implement(apiContract.admin.services).$context<{ headers: Headers }>();

  /** One entry's plain value inside the caller's window, or the refusal the contract lists. */
  async function readOf(
    id: string,
    how: EntryRead,
    headers: Headers,
    errors: EntryErrors & { VAULT_OFF: () => Error; LOCKED: () => Error },
  ) {
    const { who, session } = await ownerOf(headers, errors, { writes: true });
    const read = await entries.read(id, how, session, who);
    if (read.ok) return { value: read.value };
    if (read.reason === 'locked') throw errors.LOCKED();
    throw read.reason === 'vault-off' ? errors.VAULT_OFF() : errors.NOT_FOUND();
  }

  return {
    entries: os.entries.handler(async ({ context, input, errors }) => {
      await ownerOf(context.headers, errors);
      const list = await entries.list(input.serviceId);
      if (list === undefined) throw errors.NOT_FOUND();
      return { vault: entries.vault, entries: [...list] };
    }),
    addEntry: os.addEntry.handler(async ({ context, input, errors }) => {
      const { who } = await ownerOf(context.headers, errors, { writes: true });
      const { reason, ...entry } = input;
      const { entry: added } = done(await entries.add(entry, { who, reason }), errors);
      return { entry: added };
    }),
    editEntry: os.editEntry.handler(async ({ context, input, errors }) => {
      const { who } = await ownerOf(context.headers, errors, { writes: true });
      const { id, reason, ...changes } = input;
      const { entry } = done(await entries.edit(id, changes, { who, reason }), errors);
      return { entry };
    }),
    deleteEntry: os.deleteEntry.handler(async ({ context, input, errors }) => {
      const { who } = await ownerOf(context.headers, errors, { writes: true });
      done(await entries.remove(input.id, { who, reason: input.reason }), errors);
      return { deleted: true as const };
    }),
    unlockVault: os.unlockVault.handler(async ({ context, input, errors }) => {
      const { who, session } = await ownerOf(context.headers, errors, { writes: true });
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
      readOf(input.id, 'reveal', context.headers, errors),
    ),
    copyEntry: os.copyEntry.handler(({ context, input, errors }) =>
      readOf(input.id, 'copy', context.headers, errors),
    ),
  };
}
