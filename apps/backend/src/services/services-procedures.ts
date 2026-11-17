import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type {
  Service,
  ServiceReading as ServiceReadingAnswer,
  ServiceUsage as ServiceUsageAnswer,
} from '@slovo/contracts/admin-api';
import type {
  AccessWrite,
  ServiceMoneyBook,
  ServiceReading,
  ServiceStore,
  ServiceUsage,
  UsageRead,
  UsdRates,
} from '@slovo/server-core';

import { serviceEntriesProcedures, type EntryAccess } from './service-entries-procedures';

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
  entryAccess: EntryAccess,
  {
    book,
    ownerWrite,
    usdRates,
  }: { book: ServiceMoneyBook; ownerWrite: OwnerWrite; usdRates: UsdRates },
  usage: ServiceUsage,
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

  // The NBU rate the money in hryvnias is counted at.
  const rate = {
    usdRate: os.usdRate.handler(async ({ context, errors }) => {
      await admitOwner(context.headers, errors);
      return { rate: await usdRates.current() };
    }),
  };

  return os.router({
    list: os.list.handler(async ({ context, errors }) => {
      await admitOwner(context.headers, errors);
      const services = await store.list();
      return { services: [...services], costs: book.costs(services) };
    }),
    ...serviceEntriesProcedures(entryAccess),
    ...money,
    usage: os.usage.handler(async ({ context, errors }) => {
      await admitOwner(context.headers, errors);
      const byName = new Map((await store.list()).map((service) => [service.name, service]));
      return {
        usage: (await usage.all()).flatMap(({ name, usage: read }) => {
          const service = byName.get(name);
          return service === undefined ? [] : [usageAnswerOf(service, read)];
        }),
      };
    }),
    refreshUsage: os.refreshUsage.handler(async ({ context, input, errors }) => {
      await admitOwner(context.headers, errors, { writes: true });
      const service = (await store.list()).find(({ id }) => id === input.serviceId);
      const read = service === undefined ? undefined : await usage.refresh(service.name);
      if (service === undefined || read === undefined) throw errors.NOT_FOUND();
      return { usage: usageAnswerOf(service, read) };
    }),
    ...rate,
  });
}

/** A Service's usage as the API answers it, its times as ISO strings. */
function usageAnswerOf(service: Service, read: UsageRead): ServiceUsageAnswer {
  return {
    serviceId: service.id,
    read:
      read.state === 'unavailable'
        ? read
        : {
            state: 'read',
            reading: readingAnswerOf(read.reading),
            readAt: read.readAt.toISOString(),
            stale: read.stale,
          },
  };
}

function readingAnswerOf(reading: ServiceReading): ServiceReadingAnswer {
  if (reading.kind !== 'cron') return { ...reading, usage: [...reading.usage] };
  return {
    kind: 'cron',
    lastRun:
      reading.lastRun === null
        ? null
        : { at: reading.lastRun.at.toISOString(), succeeded: reading.lastRun.succeeded },
    nextRunAt: reading.nextRunAt?.toISOString() ?? null,
  };
}
