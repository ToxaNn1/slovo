import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { ServiceStore } from '@slovo/server-core';

/** The refusals every «Сервіси» procedure may answer. */
interface AdminErrors {
  NOT_FOUND: () => Error;
  UNAUTHORIZED: () => Error;
  FORBIDDEN: () => Error;
}

/** Admits a Власник alone to a «Сервіси» procedure, or throws the refusal the contract lists. */
export type AdmitOwner = (
  headers: Headers,
  errors: AdminErrors,
  needs?: { readonly writes?: boolean },
) => Promise<unknown>;

/** The «Сервіси» procedures of the admin API (ADR 0164): a Власник only. */
export function servicesProcedures(store: ServiceStore, admitOwner: AdmitOwner) {
  const os = implement(apiContract.admin.services).$context<{ headers: Headers }>();
  return os.router({
    list: os.list.handler(async ({ context, errors }) => {
      await admitOwner(context.headers, errors);
      return { services: [...(await store.list())] };
    }),
  });
}
