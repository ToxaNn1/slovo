import type { SentryAlertRead, SentryAnswer, SentryRead, SentryReader } from '@slovo/server-core';

/** Where and how Якість reads Sentry's REST API. */
export interface SentryApiOptions {
  readonly token: string;
  readonly org: string;
  /** The numeric id of the app's project. */
  readonly appProject: string;
  /** The numeric id of the backend's project. */
  readonly backendProject: string;
  readonly fetch?: typeof fetch;
  readonly baseUrl?: string;
}

/** Answers `unavailable` to every read: Sentry is not set up. */
export const unsetSentry: SentryReader = {
  read: () => Promise.resolve({ ok: false, reason: 'unavailable' }),
};

type Json = Record<string, unknown>;

const numberOr = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The Sentry reads of the environment's token, organization and projects, or none while one is unset. */
export function sentryOf({
  SENTRY_AUTH_TOKEN,
  SENTRY_ORG,
  SENTRY_APP_PROJECT,
  SENTRY_BACKEND_PROJECT,
}: {
  readonly SENTRY_AUTH_TOKEN?: string | undefined;
  readonly SENTRY_ORG?: string | undefined;
  readonly SENTRY_APP_PROJECT?: string | undefined;
  readonly SENTRY_BACKEND_PROJECT?: string | undefined;
}): SentryReader {
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
      });
}

/**
 * Reads Якість's numbers of Sentry's REST API. A 429 answers rate-limited
 * until its `Retry-After`, or `X-Sentry-Rate-Limit-Reset`, or a minute on.
 * Neither the app nor the backend sends an Edition tag nor traces yet (ADR
 * 0048), so every read covers every Edition, and p95 and app start answer
 * `null` until tracing is on.
 */
export function createSentryApi({
  token,
  org,
  appProject,
  backendProject,
  fetch: fetchWith = fetch,
  baseUrl = 'https://sentry.io',
}: SentryApiOptions): SentryReader {
  async function get(
    path: string,
    params: Record<string, string>,
  ): Promise<Json | Json[] | SentryAnswer> {
    const url = new URL(`/api/0/organizations/${encodeURIComponent(org)}/${path}/`, baseUrl);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await fetchWith(url, { headers: { authorization: `Bearer ${token}` } });
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      const reset = Number(response.headers.get('x-sentry-rate-limit-reset'));
      const retryAt =
        seconds > 0
          ? new Date(Date.now() + seconds * 1000)
          : reset > 0
            ? new Date(reset * 1000)
            : new Date(Date.now() + 60_000);
      return { ok: false, reason: 'rate-limited', retryAt };
    }
    if (!response.ok) return { ok: false, reason: 'unavailable' };
    return (await response.json()) as Json | Json[];
  }

  const isAnswer = (body: unknown): body is SentryAnswer =>
    typeof body === 'object' && body !== null && 'ok' in body;

  /** The first row's field of a Discover query. */
  async function discover(
    project: string,
    field: string,
    query: string,
    dataset: string,
    window: Window,
  ) {
    const body = await get('events', { ...window, project, field, query, dataset });
    if (isAnswer(body)) return body;
    const data = Array.isArray(body) ? undefined : (body['data'] as Json[] | undefined);
    return { ok: true, value: numberOr(data?.[0]?.[field]) } as const;
  }

  async function sessionTotal(
    window: Window,
    field: string,
    status?: string,
  ): Promise<SentryAnswer> {
    const body = await get('sessions', {
      ...window,
      project: appProject,
      field,
      ...(status === undefined ? {} : { groupBy: 'session.status' }),
    });
    if (isAnswer(body)) return body;
    const groups = Array.isArray(body) ? [] : ((body['groups'] as Json[] | undefined) ?? []);
    const group =
      status === undefined
        ? groups[0]
        : groups.find((row) => (row['by'] as Json | undefined)?.['session.status'] === status);
    const totals = group?.['totals'] as Json | undefined;
    const value = numberOr(totals?.[field]);
    // No group of the status is none of them; a crash-free rate comes as a share, Якість shows percent.
    if (value === null) return { ok: true, value: status === undefined ? null : 0 };
    return { ok: true, value: field.startsWith('crash_free') ? value * 100 : value };
  }

  async function newIssues(window: Window): Promise<SentryAnswer> {
    const body = await get('issues', {
      project: appProject,
      query: `firstSeen:>=${window.start} firstSeen:<=${window.end}`,
      limit: '100',
    });
    if (isAnswer(body)) return body;
    return { ok: true, value: Array.isArray(body) ? body.length : null };
  }

  /** The most events of an app issue first seen in the window. */
  async function newIssueEvents(window: Window): Promise<SentryAnswer> {
    const body = await get('issues', {
      project: appProject,
      query: `firstSeen:>=${window.start} firstSeen:<=${window.end}`,
      sort: 'freq',
      limit: '1',
    });
    if (isAnswer(body)) return body;
    const top = Array.isArray(body) ? body[0] : undefined;
    return { ok: true, value: top === undefined ? 0 : numberOr(Number(top['count'])) };
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
