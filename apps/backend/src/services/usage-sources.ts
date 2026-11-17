import type { Clock, SourceRead, ServiceReading, UsagePort } from '@slovo/server-core';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { PostHogSettings } from '../analytics/posthog-client';
import { readJson, unavailableRead } from '../development/read-json';

/** Sentry's Developer plan: 5,000 errors a month. */
export const SENTRY_ERRORS_LIMIT = 5000;
/** PostHog's free plan: 1,000,000 events a month. */
export const POSTHOG_EVENTS_LIMIT = 1_000_000;

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
 * Sentry's usage (ADR 0164): the errors the organization accepted this month,
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
 * PostHog's usage (ADR 0164): the events of the project this month, counted
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
