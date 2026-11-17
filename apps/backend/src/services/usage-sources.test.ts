import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import {
  createCloudflareUsage,
  createGitHubActionsUsage,
  createNeonUsage,
  createPostHogUsage,
  createSentryUsage,
} from './usage-sources';

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

  it('reads the compute, storage and egress of the Neon project from its API, not the database', async () => {
    const { fetch, asked } = fetchAnswering(200, {
      project: {
        id: 'quiet-leaf-123',
        compute_time_seconds: 90_000,
        synthetic_storage_size: 250_000_000,
        data_transfer_bytes: 4_500_000_000,
      },
    });
    const neon = createNeonUsage({
      apiKey: 'a-fake-key',
      projectId: 'quiet-leaf-123',
      logger,
      fetch,
    });

    expect(await neon.read()).toEqual({
      ok: true,
      value: {
        kind: 'metered',
        usage: [
          { name: 'compute', unit: 'CU-hours', used: 25, limit: 100 },
          { name: 'storage', unit: 'GB', used: 0.25, limit: 0.5 },
          { name: 'egress', unit: 'GB', used: 4.5, limit: 5 },
        ],
      },
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe('https://console.neon.tech/api/v2/projects/quiet-leaf-123');
    expect(asked[0]?.headers.get('authorization')).toBe('Bearer a-fake-key');
  });

  it('sums the Actions minutes of this month from the GitHub billing usage', async () => {
    const { fetch, asked } = fetchAnswering(200, {
      usageItems: [
        { product: 'actions', unitType: 'Minutes', quantity: 400.5, repositoryName: 'slovo' },
        { product: 'actions', unitType: 'Minutes', quantity: 99.5, repositoryName: 'other' },
        { product: 'actions', unitType: 'GigabyteHours', quantity: 7, repositoryName: 'slovo' },
        { product: 'packages', unitType: 'Minutes', quantity: 50, repositoryName: 'slovo' },
      ],
    });
    const github = createGitHubActionsUsage({
      token: 'a-fake-token',
      repository: 'ToxaNn1/slovo',
      clock,
      logger,
      fetch,
    });

    expect(await github.read()).toEqual({
      ok: true,
      value: {
        kind: 'metered',
        usage: [{ name: 'minutes', unit: 'minutes', used: 500, limit: 2000 }],
      },
    });
    const url = new URL(asked[0]?.url ?? '');
    expect(url.pathname).toBe('/users/ToxaNn1/settings/billing/usage');
    expect(url.searchParams.get('year')).toBe('2026');
    expect(url.searchParams.get('month')).toBe('11');
    expect(asked[0]?.headers.get('authorization')).toBe('Bearer a-fake-token');
  });

  it('reads R2 storage and operations and the Worker requests of today in one Cloudflare query', async () => {
    const { fetch, asked } = fetchAnswering(200, {
      data: {
        viewer: {
          accounts: [
            {
              r2StorageAdaptiveGroups: [
                { max: { payloadSize: 1_990_000_000, metadataSize: 10_000_000 } },
              ],
              r2OperationsAdaptiveGroups: [
                { sum: { requests: 1000 }, dimensions: { actionType: 'PutObject' } },
                { sum: { requests: 500 }, dimensions: { actionType: 'ListObjects' } },
                { sum: { requests: 300_000 }, dimensions: { actionType: 'GetObject' } },
                { sum: { requests: 20_000 }, dimensions: { actionType: 'HeadObject' } },
                { sum: { requests: 70 }, dimensions: { actionType: 'DeleteObject' } },
              ],
              workersInvocationsAdaptive: [
                { sum: { requests: 12_000 } },
                { sum: { requests: 3000 } },
              ],
            },
          ],
        },
      },
    });
    const cloudflare = createCloudflareUsage({
      token: 'a-fake-token',
      accountId: 'a-fake-account',
      bucket: 'slovo-media',
      clock,
      logger,
      fetch,
    });

    expect(await cloudflare.read()).toEqual({
      ok: true,
      value: {
        kind: 'metered',
        usage: [
          { name: 'r2-storage', unit: 'GB', used: 2, limit: 10 },
          { name: 'r2-class-a', unit: 'operations', used: 1500, limit: 1_000_000 },
          { name: 'r2-class-b', unit: 'operations', used: 320_000, limit: 10_000_000 },
          { name: 'worker-requests', unit: 'requests', used: 15_000, limit: 100_000 },
        ],
      },
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(asked[0]?.headers.get('authorization')).toBe('Bearer a-fake-token');
    const body = (await asked[0]?.json()) as { variables: Record<string, string> } | undefined;
    expect(body?.variables).toEqual({
      accountTag: 'a-fake-account',
      bucket: 'slovo-media',
      monthStart: '2026-11-01T00:00:00.000Z',
      dayStart: '2026-11-17T00:00:00.000Z',
      now: '2026-11-17T09:30:00.000Z',
    });
  });

  it('answers the new providers unavailable on an error or without a key', async () => {
    const graphqlError = fetchAnswering(200, { data: null, errors: [{ message: 'no access' }] });
    const refused = fetchAnswering(401, {});
    const unavailable = { ok: false, reason: 'unavailable' };

    expect(
      await createCloudflareUsage({
        token: 'a-fake-token',
        accountId: 'a-fake-account',
        bucket: 'slovo-media',
        clock,
        logger,
        fetch: graphqlError.fetch,
      }).read(),
    ).toEqual(unavailable);
    expect(
      await createNeonUsage({
        apiKey: 'a-fake-key',
        projectId: 'p',
        logger,
        fetch: refused.fetch,
      }).read(),
    ).toEqual(unavailable);
    expect(
      await createNeonUsage({
        apiKey: undefined,
        projectId: 'p',
        logger,
        fetch: refused.fetch,
      }).read(),
    ).toEqual(unavailable);
    expect(
      await createGitHubActionsUsage({
        token: undefined,
        repository: 'ToxaNn1/slovo',
        clock,
        logger,
        fetch: refused.fetch,
      }).read(),
    ).toEqual(unavailable);
    expect(
      await createCloudflareUsage({
        token: 'a-fake-token',
        accountId: undefined,
        bucket: undefined,
        clock,
        logger,
        fetch: refused.fetch,
      }).read(),
    ).toEqual(unavailable);
    expect(refused.asked).toHaveLength(1);
  });
});
