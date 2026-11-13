import type {
  Clock,
  SentryAlertRead,
  SentryAnswer,
  SentryRead,
  SentryReader,
} from '@slovo/server-core';
import { z } from 'zod';

/** Where and how Якість reads Sentry's REST API. */
export interface SentryApiOptions {
  readonly token: string;
  readonly org: string;
  /** The numeric id of the app's project. */
  readonly appProject: string;
  /** The numeric id of the backend's project. */
  readonly backendProject: string;
  /** The time a rate limit's `Retry-After` counts from. */
  readonly clock: Clock;
  readonly fetch?: typeof fetch;
  readonly baseUrl?: string;
}

/** Answers `unavailable` to every read: Sentry is not set up. */
export const unsetSentry: SentryReader = {
  read: () => Promise.resolve({ ok: false, reason: 'unavailable' }),
};

/** How long a read waits for Sentry before it answers unavailable. */
const TIMEOUT_MS = 10_000;

const RowSchema = z.record(z.string(), z.unknown());

/** A Discover query's rows of its fields. */
const EventsSchema = z.object({ data: z.array(RowSchema) });

/** The session totals, by group. */
const SessionsSchema = z.object({
  groups: z.array(z.object({ by: RowSchema.optional(), totals: RowSchema })),
});

/** The issues, each with its count of events, which Sentry writes as a string. */
const IssuesSchema = z.array(z.object({ count: z.union([z.string(), z.number()]).optional() }));

type Failure = Exclude<SentryAnswer, { ok: true }>;

const numberOr = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The Sentry reads of the environment's token, organization and projects, or none while one is unset. */
export function sentryOf(
  {
    SENTRY_AUTH_TOKEN,
    SENTRY_ORG,
    SENTRY_APP_PROJECT,
    SENTRY_BACKEND_PROJECT,
  }: {
    readonly SENTRY_AUTH_TOKEN?: string | undefined;
    readonly SENTRY_ORG?: string | undefined;
    readonly SENTRY_APP_PROJECT?: string | undefined;
    readonly SENTRY_BACKEND_PROJECT?: string | undefined;
  },
  clock: Clock,
): SentryReader {
  return SENTRY_AUTH_TOKEN === undefined ||
    SENTRY_ORG === undefined ||
    SENTRY_APP_PROJECT === undefined ||
    SENTRY_BACKEND_PROJECT === undefined
    ? unsetSentry
    : createSentryApi({
        token: SENTRY_AUTH_TOKEN,
        org: SENTRY_ORG,
        appProject: SENTRY_APP_PROJECT,
        backendProject: SENTRY_BACKEND_PROJECT,
        clock,
      });
}

/**
 * Reads Якість's numbers of Sentry's REST API. A 429 answers rate-limited
 * until its `Retry-After`, or `X-Sentry-Rate-Limit-Reset`, or a minute on;
 * an answer that fails, hangs or comes in another shape answers unavailable.
 * Neither the app nor the backend sends an Edition tag nor traces yet (ADR
 * 0048), so every read covers every Edition, and p95 and app start answer
 * `null` until tracing is on.
 */
/** The cursor of the next page a Sentry `Link` header names, or none when it holds no results. */
function nextCursor(link: string | null): string | null {
  const next = link?.split(',').find((part) => part.includes('rel="next"'));
  if (next?.includes('results="true"') !== true) return null;
  return /cursor="([^"]+)"/.exec(next)?.[1] ?? null;
}

export function createSentryApi({
  token,
  org,
  appProject,
  backendProject,
  clock,
  fetch: fetchWith = fetch,
  baseUrl = 'https://sentry.io',
}: SentryApiOptions): SentryReader {
  async function get<T>(
    path: string,
    params: Record<string, string>,
    schema: z.ZodType<T>,
  ): Promise<{ readonly ok: true; readonly body: T; readonly next: string | null } | Failure> {
    const url = new URL(`/api/0/organizations/${encodeURIComponent(org)}/${path}/`, baseUrl);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    try {
      const response = await fetchWith(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 429) {
        const seconds = Number(response.headers.get('retry-after'));
        const reset = Number(response.headers.get('x-sentry-rate-limit-reset'));
        const now = clock.now().getTime();
        const retryAt =
          seconds > 0
            ? new Date(now + seconds * 1000)
            : reset > 0
              ? new Date(reset * 1000)
              : new Date(now + 60_000);
        return { ok: false, reason: 'rate-limited', retryAt };
      }
      if (!response.ok) return { ok: false, reason: 'unavailable' };
      const parsed = schema.safeParse(await response.json());
      return parsed.success
        ? { ok: true, body: parsed.data, next: nextCursor(response.headers.get('link')) }
        : { ok: false, reason: 'unavailable' };
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  }

  /** The first row's field of a Discover query. */
  async function discover(
    project: string,
    field: string,
    query: string,
    dataset: string,
    window: Window,
  ) {
    const answer = await get('events', { ...window, project, field, query, dataset }, EventsSchema);
    if (!answer.ok) return answer;
    return { ok: true, value: numberOr(answer.body.data[0]?.[field]) } as const;
  }

  async function sessionTotal(
    window: Window,
    field: string,
    status?: string,
  ): Promise<SentryAnswer> {
    const answer = await get(
      'sessions',
      {
        ...window,
        project: appProject,
        field,
        ...(status === undefined ? {} : { groupBy: 'session.status' }),
      },
      SessionsSchema,
    );
    if (!answer.ok) return answer;
    const { groups } = answer.body;
    const group =
      status === undefined
        ? groups[0]
        : groups.find((row) => row.by?.['session.status'] === status);
    const value = numberOr(group?.totals[field]);
    // No group of the status is none of them; a crash-free rate comes as a share, Якість shows percent.
    if (value === null) return { ok: true, value: status === undefined ? null : 0 };
    return { ok: true, value: field.startsWith('crash_free') ? value * 100 : value };
  }

  /** The app issues first seen in the window, a page of 100 at a time. */
  async function newIssues(window: Window): Promise<SentryAnswer> {
    const params = {
      project: appProject,
      query: `firstSeen:>=${window.start} firstSeen:<=${window.end}`,
      limit: '100',
    };
    const page = (cursor: string | null) =>
      get('issues', cursor === null ? params : { ...params, cursor }, IssuesSchema);
    let answer = await page(null);
    let count = 0;
    while (answer.ok) {
      count += answer.body.length;
      if (answer.next === null) return { ok: true, value: count };
      answer = await page(answer.next);
    }
    return answer;
  }

  /** The most events of an app issue first seen in the window. */
  async function newIssueEvents(window: Window): Promise<SentryAnswer> {
    const answer = await get(
      'issues',
      {
        project: appProject,
        query: `firstSeen:>=${window.start} firstSeen:<=${window.end}`,
        sort: 'freq',
        limit: '1',
      },
      IssuesSchema,
    );
    if (!answer.ok) return answer;
    const [top] = answer.body;
    return { ok: true, value: top === undefined ? 0 : numberOr(Number(top.count)) };
  }

  /** The backend's transactions answered 5xx, in percent of all, or `null` with none. */
  async function backendErrorRate(window: Window): Promise<SentryAnswer> {
    const count = (query: string) =>
      discover(backendProject, 'count()', query, 'transactions', window);
    const all = await count('event.type:transaction');
    if (!all.ok) return all;
    const failed = await count('event.type:transaction http.status_code:5*');
    if (!failed.ok) return failed;
    if (all.value === null || all.value === 0) return { ok: true, value: null };
    return { ok: true, value: ((failed.value ?? 0) / all.value) * 100 };
  }

  const reads: Record<SentryRead | SentryAlertRead, (window: Window) => Promise<SentryAnswer>> = {
    newIssueEvents,
    backendErrorRate,
    crashFree: (window) => sessionTotal(window, 'crash_free_rate(session)'),
    crashes: (window) => sessionTotal(window, 'sum(session)', 'crashed'),
    errors: (window) => discover(appProject, 'count()', 'event.type:error', 'errors', window),
    newIssues,
    backendP95: (window) =>
      discover(
        backendProject,
        'p95(transaction.duration)',
        'event.type:transaction',
        'transactions',
        window,
      ),
    appStart: (window) =>
      discover(
        appProject,
        'p95(measurements.app_start_cold)',
        'event.type:transaction',
        'transactions',
        window,
      ),
  };

  return {
    read: (read, { from, to }) => reads[read]({ start: from.toISOString(), end: to.toISOString() }),
  };
}

interface Window extends Record<string, string> {
  readonly start: string;
  readonly end: string;
}
