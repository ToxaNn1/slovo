import type { Clock, SourceRead, ServiceReading, UsagePort } from '@slovo/server-core';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { PostHogSettings } from '../analytics/posthog-client';
import { readJson, unavailableRead } from '../development/read-json';

/** Sentry's Developer plan: 5,000 errors a month. */
const SENTRY_ERRORS_LIMIT = 5000;
/** PostHog's free plan: 1,000,000 events a month. */
const POSTHOG_EVENTS_LIMIT = 1_000_000;

/** The first moment of the clock's month, in UTC, as the providers count a month. */
function monthStart(clock: Clock): Date {
  const now = clock.now();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** A metered reading of one limit. */
function metered(
  name: string,
  unit: string,
  used: number,
  limit: number,
): SourceRead<ServiceReading> {
  return { ok: true, value: { kind: 'metered', usage: [{ name, unit, used, limit }] } };
}

/** The organization's stats: one group, its accepted quantity. */
const SentryStatsSchema = z.object({
  groups: z.array(z.object({ totals: z.object({ 'sum(quantity)': z.number().min(0) }) })),
});

/**
 * Sentry's usage: the errors the organization accepted this month,
 * from its stats API, with Якість's token (`org:read`). One request a read.
 */
export function createSentryUsage({
  token,
  org,
  clock,
  logger,
  fetch = globalThis.fetch,
  baseUrl = 'https://sentry.io',
}: {
  readonly token: string | undefined;
  readonly org: string | undefined;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly fetch?: typeof globalThis.fetch;
  readonly baseUrl?: string;
}): UsagePort {
  if (token === undefined || org === undefined) return { read: unavailableRead };
  return {
    async read() {
      const url = new URL(`/api/0/organizations/${encodeURIComponent(org)}/stats_v2/`, baseUrl);
      const params = {
        field: 'sum(quantity)',
        category: 'error',
        outcome: 'accepted',
        interval: '1d',
        start: monthStart(clock).toISOString(),
        end: clock.now().toISOString(),
      };
      for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
      const answer = await readJson(
        fetch,
        logger,
        url.toString(),
        { headers: { authorization: `Bearer ${token}` } },
        SentryStatsSchema,
      );
      if (!answer.ok) return answer;
      const used = answer.value.groups.reduce(
        (sum, group) => sum + group.totals['sum(quantity)'],
        0,
      );
      return metered('errors', 'events', used, SENTRY_ERRORS_LIMIT);
    },
  };
}

/** PostHog's answer to the count: one row of one number. */
const PostHogCountSchema = z.object({ results: z.tuple([z.tuple([z.coerce.number().min(0)])]) });

/**
 * PostHog's usage: the events of the project this month, counted
 * by one HogQL query with the Аналітика's key (`query`). One request a read.
 */
export function createPostHogUsage({
  settings,
  logger,
  fetch = globalThis.fetch,
}: {
  readonly settings: PostHogSettings | undefined;
  readonly logger: Logger;
  readonly fetch?: typeof globalThis.fetch;
}): UsagePort {
  if (settings === undefined) return { read: unavailableRead };
  const { apiKey, projectId, host } = settings;
  return {
    async read() {
      const answer = await readJson(
        fetch,
        logger,
        `${host}/api/projects/${projectId}/query/`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            query: {
              kind: 'HogQLQuery',
              query: 'SELECT count() FROM events WHERE timestamp >= toStartOfMonth(now())',
            },
          }),
        },
        PostHogCountSchema,
      );
      if (!answer.ok) return answer;
      const [[used]] = answer.value.results;
      return metered('events', 'events', used, POSTHOG_EVENTS_LIMIT);
    },
  };
}

/** A billing unit's bytes: the providers' free plans count decimal gigabytes. */
const GB = 1_000_000_000;

/** A quantity to two decimals, as a bar reads it. */
const hundredths = (value: number) => Math.round(value * 100) / 100;

/** Neon's free plan, per project and month: CU-hours of compute, storage and egress. */
const NEON_LIMITS = { computeHours: 100, storageGb: 0.5, egressGb: 5 } as const;

/** The project as Neon's API answers it: this period's consumption. */
const NeonProjectSchema = z.object({
  project: z.object({
    compute_time_seconds: z.number().min(0),
    synthetic_storage_size: z.number().min(0),
    data_transfer_bytes: z.number().min(0),
  }),
});

/**
 * Neon's usage: the project's compute, storage and egress of this
 * period, from Neon's management API with `NEON_API_KEY`. One request a read;
 * it never connects to the database, so it neither wakes the compute nor
 * counts against the egress it reports.
 */
export function createNeonUsage({
  apiKey,
  projectId,
  logger,
  fetch = globalThis.fetch,
}: {
  readonly apiKey: string | undefined;
  readonly projectId: string | undefined;
  readonly logger: Logger;
  readonly fetch?: typeof globalThis.fetch;
}): UsagePort {
  if (apiKey === undefined || projectId === undefined) return { read: unavailableRead };
  return {
    async read() {
      const answer = await readJson(
        fetch,
        logger,
        `https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`,
        { headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' } },
        NeonProjectSchema,
      );
      if (!answer.ok) return answer;
      const { project } = answer.value;
      return {
        ok: true,
        value: {
          kind: 'metered',
          usage: [
            {
              name: 'compute',
              unit: 'CU-hours',
              used: hundredths(project.compute_time_seconds / 3600),
              limit: NEON_LIMITS.computeHours,
            },
            {
              name: 'storage',
              unit: 'GB',
              used: hundredths(project.synthetic_storage_size / GB),
              limit: NEON_LIMITS.storageGb,
            },
            {
              name: 'egress',
              unit: 'GB',
              used: hundredths(project.data_transfer_bytes / GB),
              limit: NEON_LIMITS.egressGb,
            },
          ],
        },
      };
    },
  };
}

/** GitHub Free's Actions minutes a month. */
const GITHUB_ACTIONS_MINUTES_LIMIT = 2000;

/** The account's billing usage: one item per day, product, SKU and repository. */
const GitHubUsageSchema = z.object({
  usageItems: z.array(
    z.object({
      product: z.string(),
      /** The runner, e.g. `Actions Linux`, `Actions macOS`. */
      sku: z.string().optional(),
      unitType: z.string(),
      quantity: z.number().min(0),
      repositoryName: z.string().optional(),
    }),
  ),
});

/**
 * How many of the included minutes one minute on the runner takes: a macOS
 * minute 10, a Windows minute 2, a Linux one 1.
 */
function minuteFactor(sku: string | undefined): number {
  const runner = sku?.toLowerCase() ?? '';
  if (runner.includes('macos')) return 10;
  if (runner.includes('windows')) return 2;
  return 1;
}

/** Whether a repository is private: GitHub Free's minutes meter private repositories only. */
const GitHubRepositorySchema = z.object({ private: z.boolean() });

/**
 * GitHub Actions' usage: the Actions minutes of the repository's
 * owner this calendar month (UTC), from the billing usage report, with
 * Розробка's `GITHUB_TOKEN` (which also needs the Plan read permission).
 * A public repository's minutes are free and meter no limit, so the
 * repository's own minutes count only while it is private; any
 * other repository's count, as its visibility is not read. Two requests a read.
 */
export function createGitHubActionsUsage({
  token,
  repository,
  clock,
  logger,
  fetch = globalThis.fetch,
}: {
  readonly token: string | undefined;
  readonly repository: string;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly fetch?: typeof globalThis.fetch;
}): UsagePort {
  if (token === undefined) return { read: unavailableRead };
  const [owner = '', name = ''] = repository.split('/');
  return {
    async read() {
      const now = clock.now();
      const url = new URL(
        `/users/${encodeURIComponent(owner)}/settings/billing/usage`,
        'https://api.github.com',
      );
      url.searchParams.set('year', String(now.getUTCFullYear()));
      url.searchParams.set('month', String(now.getUTCMonth() + 1));
      const init = {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
      };
      const [answer, visibility] = await Promise.all([
        readJson(fetch, logger, url.toString(), init, GitHubUsageSchema),
        readJson(
          fetch,
          logger,
          new URL(`/repos/${repository}`, 'https://api.github.com').toString(),
          init,
          GitHubRepositorySchema,
        ),
      ]);
      if (!answer.ok) return answer;
      const isPublic = visibility.ok && !visibility.value.private;
      const minutes = answer.value.usageItems
        .filter((item) => item.product === 'actions' && item.unitType.toLowerCase() === 'minutes')
        .filter((item) => !(isPublic && item.repositoryName === name))
        .reduce((sum, item) => sum + item.quantity * minuteFactor(item.sku), 0);
      return metered('minutes', 'minutes', Math.round(minutes), GITHUB_ACTIONS_MINUTES_LIMIT);
    },
  };
}

/** Cloudflare's free limits: R2 a month, a Worker's requests a day. */
const CLOUDFLARE_LIMITS = {
  r2StorageGb: 10,
  r2ClassA: 1_000_000,
  r2ClassB: 10_000_000,
  workerRequestsPerDay: 100_000,
} as const;

/** R2's operations that bill as Class A; Class B's are below, the rest are free. */
const R2_CLASS_A = new Set([
  'ListBuckets',
  'PutBucket',
  'ListObjects',
  'PutObject',
  'CopyObject',
  'CompleteMultipartUpload',
  'CreateMultipartUpload',
  'ListMultipartUploads',
  'UploadPart',
  'UploadPartCopy',
  'ListParts',
  'PutBucketEncryption',
  'PutBucketCors',
  'PutBucketLifecycleConfiguration',
]);
const R2_CLASS_B = new Set([
  'HeadBucket',
  'HeadObject',
  'GetObject',
  'UsageSummary',
  'GetBucketEncryption',
  'GetBucketLocation',
  'GetBucketCors',
  'GetBucketLifecycleConfiguration',
]);

/** One query of Cloudflare's GraphQL Analytics API for the R2 bucket and the account's Workers. */
const CLOUDFLARE_QUERY = `query ($accountTag: string!, $bucket: string!, $monthStart: Time!, $dayStart: Time!, $now: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(limit: 1, filter: { bucketName: $bucket, datetime_geq: $monthStart, datetime_leq: $now }) {
        max { payloadSize metadataSize }
      }
      r2OperationsAdaptiveGroups(limit: 100, filter: { bucketName: $bucket, datetime_geq: $monthStart, datetime_leq: $now }) {
        sum { requests }
        dimensions { actionType }
      }
      workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $dayStart, datetime_leq: $now }) {
        sum { requests }
      }
    }
  }
}`;

const CloudflareUsageSchema = z.object({
  data: z.object({
    viewer: z.object({
      accounts: z.tuple([
        z.object({
          r2StorageAdaptiveGroups: z.array(
            z.object({
              max: z.object({ payloadSize: z.number().min(0), metadataSize: z.number().min(0) }),
            }),
          ),
          r2OperationsAdaptiveGroups: z.array(
            z.object({
              sum: z.object({ requests: z.number().min(0) }),
              dimensions: z.object({ actionType: z.string() }),
            }),
          ),
          workersInvocationsAdaptive: z.array(
            z.object({ sum: z.object({ requests: z.number().min(0) }) }),
          ),
        }),
      ]),
    }),
  }),
});

/**
 * Cloudflare's usage: the Media Store's R2 storage and Class A and
 * B operations this calendar month (UTC), and the account's Worker requests
 * today, in one GraphQL Analytics query with `CLOUDFLARE_API_TOKEN` (Account
 * Analytics: Read) on the R2 account and bucket. One request a read.
 */
export function createCloudflareUsage({
  token,
  accountId,
  bucket,
  clock,
  logger,
  fetch = globalThis.fetch,
}: {
  readonly token: string | undefined;
  readonly accountId: string | undefined;
  readonly bucket: string | undefined;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly fetch?: typeof globalThis.fetch;
}): UsagePort {
  if (token === undefined || accountId === undefined || bucket === undefined) {
    return { read: unavailableRead };
  }
  return {
    async read() {
      const now = clock.now();
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const answer = await readJson(
        fetch,
        logger,
        'https://api.cloudflare.com/client/v4/graphql',
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            query: CLOUDFLARE_QUERY,
            variables: {
              accountTag: accountId,
              bucket,
              monthStart: monthStart(clock).toISOString(),
              dayStart: dayStart.toISOString(),
              now: now.toISOString(),
            },
          }),
        },
        CloudflareUsageSchema,
      );
      if (!answer.ok) return answer;
      const [account] = answer.value.data.viewer.accounts;
      const stored = account.r2StorageAdaptiveGroups.reduce(
        (sum, group) => sum + group.max.payloadSize + group.max.metadataSize,
        0,
      );
      const operations = (kinds: ReadonlySet<string>) =>
        account.r2OperationsAdaptiveGroups
          .filter((group) => kinds.has(group.dimensions.actionType))
          .reduce((sum, group) => sum + group.sum.requests, 0);
      const workerRequests = account.workersInvocationsAdaptive.reduce(
        (sum, group) => sum + group.sum.requests,
        0,
      );
      return {
        ok: true,
        value: {
          kind: 'metered',
          usage: [
            {
              name: 'r2-storage',
              unit: 'GB',
              used: hundredths(stored / GB),
              limit: CLOUDFLARE_LIMITS.r2StorageGb,
            },
            {
              name: 'r2-class-a',
              unit: 'operations',
              used: operations(R2_CLASS_A),
              limit: CLOUDFLARE_LIMITS.r2ClassA,
            },
            {
              name: 'r2-class-b',
              unit: 'operations',
              used: operations(R2_CLASS_B),
              limit: CLOUDFLARE_LIMITS.r2ClassB,
            },
            {
              name: 'worker-requests',
              unit: 'requests',
              used: workerRequests,
              limit: CLOUDFLARE_LIMITS.workerRequestsPerDay,
            },
          ],
        },
      };
    },
  };
}
