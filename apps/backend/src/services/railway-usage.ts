import type {
  Clock,
  RailwaySpendPart,
  ServiceReading,
  SourceRead,
  UsagePort,
} from '@slovo/server-core';
import type { Logger } from 'pino';
import { z } from 'zod';

import { readJson, unavailableRead } from '../development/read-json';

/** Railway's Hobby plan: $5 of usage a month is included. */
const RAILWAY_INCLUDED_USD = 5;

/**
 * Railway's price of each measurement its usage answers, in USD: a vCPU and
 * a GB of memory or of volume by the minute, a GB of egress whole.
 */
const PRICE_USD = {
  CPU_USAGE: 0.000463,
  MEMORY_USAGE_GB: 0.000231,
  NETWORK_TX_GB: 0.05,
  DISK_USAGE_GB: 0.00000347,
} as const;
const MEASUREMENTS = ['CPU_USAGE', 'MEMORY_USAGE_GB', 'NETWORK_TX_GB', 'DISK_USAGE_GB'] as const;

/** The part of the spend each measurement is. */
const PART = {
  CPU_USAGE: 'cpu',
  MEMORY_USAGE_GB: 'memory',
  NETWORK_TX_GB: 'egress',
  DISK_USAGE_GB: 'disk',
} as const satisfies Record<(typeof MEASUREMENTS)[number], RailwaySpendPart>;

/** Dollars rounded to cents. */
const cents = (usd: number) => Math.round(usd * 100) / 100;

/** The Deployment's Railway service that serves the backend. */
const BACKEND = 'backend';
/** The Deployment's Cron services on Railway (.railway/railway.ts), each a Service of that name. */
export const RAILWAY_CRONS = ['alerts', 'quote-check', 'recordings'] as const;
/** Railway's usage ports by the Service they answer: the backend's and each Cron's. */
export type RailwayUsage = Readonly<Record<'Railway' | (typeof RAILWAY_CRONS)[number], UsagePort>>;

/** The project's services, each one's instance per environment, and its usage this month: one request. */
const QUERY = `query SlovoServices($projectId: String!, $startDate: DateTime!) {
  project(id: $projectId) {
    services { edges { node { name serviceInstances { edges { node {
      environmentId nextCronRunAt latestDeployment { status updatedAt }
    } } } } } }
  }
  usage(projectId: $projectId, startDate: $startDate, measurements: [${MEASUREMENTS.join(', ')}]) {
    measurement value
  }
}`;

const AnswerSchema = z.object({
  data: z.object({
    project: z.object({
      services: z.object({
        edges: z.array(
          z.object({
            node: z.object({
              name: z.string(),
              serviceInstances: z.object({
                edges: z.array(
                  z.object({
                    node: z.object({
                      environmentId: z.string(),
                      nextCronRunAt: z.coerce.date().nullable(),
                      latestDeployment: z
                        .object({ status: z.string(), updatedAt: z.coerce.date() })
                        .nullable(),
                    }),
                  }),
                ),
              }),
            }),
          }),
        ),
      }),
    }),
    usage: z.array(z.object({ measurement: z.enum(MEASUREMENTS), value: z.number().min(0) })),
  }),
});
type Answer = z.output<typeof AnswerSchema>['data'];

/** The Railway project and environment the backend runs in, and a token that reads them. */
export interface RailwaySettings {
  readonly token: string;
  readonly projectId: string;
  readonly environmentId: string;
}

/** A Cron run that ended: Railway marks it `SUCCESS` or, on a non-zero exit, `CRASHED` or `FAILED`. */
const ENDED: Readonly<Record<string, boolean>> = { SUCCESS: true, CRASHED: false, FAILED: false };

/**
 * Railway's usage ports, by Service name: `Railway` answers the
 * backend Online while its latest deployment is up, and this month's spend
 * against the plan's included usage; each Cron its last run and its next.
 * One GraphQL request answers them all: the reads that come together share it.
 */
export function createRailwayUsage({
  settings,
  clock,
  logger,
  fetch = globalThis.fetch,
  url = 'https://backboard.railway.com/graphql/v2',
}: {
  readonly settings: RailwaySettings | undefined;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly fetch?: typeof globalThis.fetch;
  readonly url?: string;
}): RailwayUsage {
  if (settings === undefined) {
    const unavailable = { read: unavailableRead };
    return {
      Railway: unavailable,
      alerts: unavailable,
      'quote-check': unavailable,
      recordings: unavailable,
    };
  }
  const { token, projectId, environmentId } = settings;
  let pending: Promise<SourceRead<Answer>> | undefined;
  function ask(): Promise<SourceRead<Answer>> {
    if (pending !== undefined) return pending;
    const now = clock.now();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const asking = readJson(
      fetch,
      logger,
      url,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: QUERY,
          variables: { projectId, startDate: startDate.toISOString() },
        }),
      },
      AnswerSchema,
    ).then((answer) => (answer.ok ? { ok: true as const, value: answer.value.data } : answer));
    pending = asking;
    void asking.finally(() => {
      pending = undefined;
    });
    return asking;
  }
  function instanceOf(answer: Answer, name: string) {
    const service = answer.project.services.edges.find(({ node }) => node.name === name);
    return service?.node.serviceInstances.edges.find(
      ({ node }) => node.environmentId === environmentId,
    )?.node;
  }
  function port(readingOf: (answer: Answer) => ServiceReading): UsagePort {
    return {
      async read() {
        const answer = await ask();
        return answer.ok ? { ok: true, value: readingOf(answer.value) } : answer;
      },
    };
  }
  const backend = port((answer) => {
    const spendOf = (measurement: (typeof MEASUREMENTS)[number]) =>
      answer.usage
        .filter((each) => each.measurement === measurement)
        .reduce((sum, { value }) => sum + value * PRICE_USD[measurement], 0);
    const spend = MEASUREMENTS.reduce((sum, measurement) => sum + spendOf(measurement), 0);
    return {
      kind: 'railway',
      state:
        instanceOf(answer, BACKEND)?.latestDeployment?.status === 'SUCCESS' ? 'online' : 'offline',
      usage: [
        {
          name: 'spend',
          unit: 'USD',
          used: cents(spend),
          limit: RAILWAY_INCLUDED_USD,
        },
      ],
      spendParts: MEASUREMENTS.map((measurement) => ({
        part: PART[measurement],
        usd: cents(spendOf(measurement)),
      })),
    };
  });
  const cron = (name: (typeof RAILWAY_CRONS)[number]) =>
    port((answer) => {
      const instance = instanceOf(answer, name);
      const run = instance?.latestDeployment;
      const succeeded = run === null || run === undefined ? undefined : ENDED[run.status];
      return {
        kind: 'cron',
        lastRun: run && succeeded !== undefined ? { at: run.updatedAt, succeeded } : null,
        nextRunAt: instance?.nextCronRunAt ?? null,
      };
    });
  return {
    Railway: backend,
    alerts: cron('alerts'),
    'quote-check': cron('quote-check'),
    recordings: cron('recordings'),
  };
}
