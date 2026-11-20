import type { Clock, SourceRead } from '../ports';
import { cachedRead, type FreshRead } from '../sources/cached-source';

/** How long a Service's usage is kept before its provider is read again. */
export const USAGE_FRESH_MS = 60 * 60 * 1000;

/** One limit of a Service's plan and how much of it the current period used: `used` of `limit` `unit`. */
export interface LimitUsage {
  readonly name: string;
  readonly unit: string;
  readonly used: number;
  readonly limit: number;
}

/** What Railway bills a month by: the vCPU, the memory, the egress and the volume. */
export type RailwaySpendPart = 'cpu' | 'memory' | 'egress' | 'disk';

/**
 * What a provider answers of a Service, by the Service's kind: a metered
 * Service its usage per limit, a Railway service also whether it is online
 * and its spend by each part Railway bills, a Cron its last run and its next.
 */
export type ServiceReading =
  | { readonly kind: 'metered'; readonly usage: readonly LimitUsage[] }
  | {
      readonly kind: 'railway';
      readonly state: 'online' | 'offline';
      readonly usage: readonly LimitUsage[];
      /** This month's spend of each part, in USD rounded to cents. */
      readonly spendParts: readonly { readonly part: RailwaySpendPart; readonly usd: number }[];
    }
  | {
      readonly kind: 'cron';
      readonly lastRun: { readonly at: Date; readonly succeeded: boolean } | null;
      readonly nextRunAt: Date | null;
    };

/**
 * The one usage port: a provider's API read with the key the
 * Deployment's environment holds. Each provider is an adapter of it; it
 * answers `unavailable` when the provider refuses, fails or is not set up.
 */
export interface UsagePort {
  read(): Promise<SourceRead<ServiceReading>>;
}

/** A Service's usage as the section shows it: the reading and when it was read, or none to show. */
export type UsageRead =
  | {
      readonly state: 'read';
      readonly reading: ServiceReading;
      readonly readAt: Date;
      /** The latest read failed and this is the last good one. */
      readonly stale: boolean;
    }
  | { readonly state: 'unavailable' };

/** The usage of every Service with a usage port, by the Service's name. */
export interface ServiceUsage {
  /** Each ported Service's usage, kept for an hour. */
  all(): Promise<readonly { readonly name: string; readonly usage: UsageRead }[]>;
  /** Reads the named Service's provider now («Оновити»); `undefined` when it has no port. */
  refresh(name: string): Promise<UsageRead | undefined>;
}

/**
 * Reads each Service's usage port through the cached read: an hour fresh, a
 * refresh on demand, and the last good reading kept, marked stale, when a
 * read fails.
 */
export function createServiceUsage({
  ports,
  clock,
}: {
  readonly ports: Readonly<Record<string, UsagePort>>;
  readonly clock: Clock;
}): ServiceUsage {
  const reads = new Map(
    Object.entries(ports).map(([name, port]) => [
      name,
      cachedRead(clock, USAGE_FRESH_MS, () => port.read()),
    ]),
  );
  async function usageOf(
    read: (options: { refresh: boolean }) => Promise<FreshRead<ServiceReading>>,
    refresh: boolean,
  ): Promise<UsageRead> {
    const answer = await read({ refresh });
    return answer.ok
      ? { state: 'read', reading: answer.value, readAt: answer.fetchedAt, stale: answer.stale }
      : { state: 'unavailable' };
  }
  return {
    all: () =>
      Promise.all(
        [...reads].map(async ([name, read]) => ({ name, usage: await usageOf(read, false) })),
      ),
    async refresh(name) {
      const read = reads.get(name);
      return read === undefined ? undefined : usageOf(read, true);
    },
  };
}
