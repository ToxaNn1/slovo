import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type {
  Service,
  ServiceReading as ServiceReadingAnswer,
  ServiceUsage as ServiceUsageAnswer,
} from '@slovo/contracts/admin-api';
import type { ServiceReading, ServiceStore, ServiceUsage, UsageRead } from '@slovo/server-core';

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
export function servicesProcedures(
  store: ServiceStore,
  admitOwner: AdmitOwner,
  usage: ServiceUsage,
) {
  const os = implement(apiContract.admin.services).$context<{ headers: Headers }>();
  return os.router({
    list: os.list.handler(async ({ context, errors }) => {
      await admitOwner(context.headers, errors);
      return { services: [...(await store.list())] };
    }),
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
