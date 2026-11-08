import type { AnalyticsQuery, AnalyticsRow, PostHogPort } from '@slovo/server-core';
import { z } from 'zod';

/** Where PostHog's query API is, and the personal API key (read-only `query` scope) it takes. */
export interface PostHogSettings {
  readonly apiKey: string;
  readonly projectId: string;
  readonly host: string;
}

/** The days of the Аналітика are Kyiv's. */
const DAY = "toString(toDate(timestamp, 'Europe/Kyiv'))";
/** An event's Edition and day in the period. */
const IN_PERIOD = `properties.edition IN {editions} AND ${DAY} >= {from} AND ${DAY} <= {to}`;
/** A Feature Switch's name, so it is safe inside a property's name. */
const FEATURE = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * The HogQL of a query and its values. Each answers a key and a count per
 * row: people are only ever counted, never selected (ADR 0060).
 */
export function hogQlOf(query: AnalyticsQuery): { sql: string; values: Record<string, unknown> } {
  const editions = [...query.editionIds];
  if (query.kind === 'variants') {
    if (!FEATURE.test(query.feature)) throw new Error(`not a Feature Switch: ${query.feature}`);
    const variant = `properties.variant_${query.feature}`;
    return {
      sql: `SELECT toString(${variant}) AS key, count(DISTINCT distinct_id) FROM events WHERE properties.edition IN {editions} AND ${variant} IS NOT NULL GROUP BY key ORDER BY key`,
      values: { editions },
    };
  }
  const values = { editions, from: query.period.from, to: query.period.to };
  const byPeople = (key: string, where = 'true') => ({
    sql: `SELECT toString(${key}) AS key, count(DISTINCT distinct_id) FROM events WHERE ${IN_PERIOD} AND ${where} GROUP BY key ORDER BY key`,
    values,
  });
  switch (query.kind) {
    case 'activeByDay':
      return byPeople(DAY);
    case 'devices':
      return byPeople('properties.$os');
    case 'appVersions':
      return byPeople('properties.$app_version');
    case 'visitsByDay':
      return {
        sql: `SELECT ${DAY} AS key, count() FROM events WHERE event = 'sessionStarted' AND ${IN_PERIOD} GROUP BY key ORDER BY key`,
        values,
      };
    case 'visitSeconds':
      return {
        sql: `SELECT 'median' AS key, coalesce(median(toFloat(properties.durationSeconds)), 0) FROM events WHERE event = 'sessionEnded' AND ${IN_PERIOD}`,
        values,
      };
  }
}

/** PostHog's answer to a HogQL query: its rows, each a key and a count. */
const HogQlAnswerSchema = z.object({
  results: z.array(z.tuple([z.string().nullable(), z.coerce.number()])),
});

/**
 * Reads the aggregates of the Analytics events from PostHog's query API. It
 * answers that it can't when PostHog refuses or is unreachable.
 */
export function createPostHogClient(
  { apiKey, projectId, host }: PostHogSettings,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): PostHogPort {
  return {
    async query(query) {
      const { sql, values } = hogQlOf(query);
      try {
        const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql, values } }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) return { ok: false };
        const parsed = HogQlAnswerSchema.safeParse(await response.json());
        if (!parsed.success) return { ok: false };
        const rows: AnalyticsRow[] = parsed.data.results.map(([key, count]) => ({
          key: key ?? '',
          count: Math.max(0, Math.round(count)),
        }));
        return { ok: true, rows };
      } catch {
        return { ok: false };
      }
    },
  };
}

/** The port while no PostHog key is set: it can't answer. */
export const unavailablePostHog: PostHogPort = { query: () => Promise.resolve({ ok: false }) };
