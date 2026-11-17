import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { createPostHogUsage, createSentryUsage } from './usage-sources';

const logger = pino({ level: 'silent' });
const clock = { now: () => new Date('2026-11-17T09:30:00.000Z') };

/** A fetch that answers the body, and the requests it was given. */
function fetchAnswering(status: number, body: unknown) {
  const asked: Request[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    asked.push(new Request(input, init));
    return Promise.resolve(Response.json(body, { status }));
  };
  return { fetch, asked };
}

describe('the usage sources', () => {
  it('reads the errors Sentry accepted this month', async () => {
    const { fetch, asked } = fetchAnswering(200, {
      groups: [{ by: {}, totals: { 'sum(quantity)': 1234 } }],
    });
    const sentry = createSentryUsage({ token: 'a-fake-token', org: 'slovo', clock, logger, fetch });

    expect(await sentry.read()).toEqual({
      ok: true,
      value: {
        kind: 'metered',
        usage: [{ name: 'errors', unit: 'events', used: 1234, limit: 5000 }],
      },
    });
    const url = new URL(asked[0]?.url ?? '');
    expect(url.pathname).toBe('/api/0/organizations/slovo/stats_v2/');
    expect(url.searchParams.get('category')).toBe('error');
    expect(url.searchParams.get('start')).toBe('2026-11-01T00:00:00.000Z');
    expect(asked[0]?.headers.get('authorization')).toBe('Bearer a-fake-token');
  });

  it('counts the PostHog events of this month', async () => {
    const { fetch, asked } = fetchAnswering(200, { results: [[250000]] });
    const posthog = createPostHogUsage({
      settings: { apiKey: 'a-fake-key', projectId: '42', host: 'https://eu.posthog.com' },
      logger,
      fetch,
    });

    expect(await posthog.read()).toEqual({
      ok: true,
      value: {
        kind: 'metered',
        usage: [{ name: 'events', unit: 'events', used: 250000, limit: 1_000_000 }],
      },
    });
    expect(asked[0]?.url).toBe('https://eu.posthog.com/api/projects/42/query/');
  });

  it('answers unavailable on a refusal or without a key', async () => {
    const { fetch } = fetchAnswering(403, {});

    expect(
      await createSentryUsage({ token: 'a-fake-token', org: 'slovo', clock, logger, fetch }).read(),
    ).toEqual({ ok: false, reason: 'unavailable' });
    expect(await createPostHogUsage({ settings: undefined, logger }).read()).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
