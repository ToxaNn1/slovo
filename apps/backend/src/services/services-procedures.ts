import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { AccessWrite, ServiceMoneyBook, ServiceStore } from '@slovo/server-core';

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

/** Admits a Власник alone to a «Сервіси» write: who writes it, and why, for the Action log. */
export type OwnerWrite = (
  headers: Headers,
  errors: AdminErrors,
  reason: string,
) => Promise<AccessWrite>;

/** The «Сервіси» procedures of the admin API (ADR 0164): a Власник only. */
export function servicesProcedures(
  store: ServiceStore,
  admitOwner: AdmitOwner,
  { book, ownerWrite }: { book: ServiceMoneyBook; ownerWrite: OwnerWrite },
) {
  const os = implement(apiContract.admin.services).$context<{ headers: Headers }>();

  // The writes of a Service's money and of a new Service, each with a reason and an Action log row.
  const money = {
    add: os.add.handler(async ({ context, input, errors }) => {
      const { reason, ...service } = input;
      const added = await book.add(service, await ownerWrite(context.headers, errors, reason));
      if (!added.ok) throw errors.CONFLICT({ data: { refusal: added.reason } });
      return { service: added.service };
    }),
    editMoney: os.editMoney.handler(async ({ context, input, errors }) => {
      const { id, reason, ...fields } = input;
      const write = await ownerWrite(context.headers, errors, reason);
      const edited = await book.editMoney(id, fields, write);
      if (!edited.ok) throw errors.CONFLICT({ data: { refusal: edited.reason } });
      return { service: edited.service, changed: edited.changed };
    }),
  };

  return os.router({
    list: os.list.handler(async ({ context, errors }) => {
      await admitOwner(context.headers, errors);
      const services = await store.list();
      return { services: [...services], costs: book.costs(services) };
    }),
    ...money,
  });
}
