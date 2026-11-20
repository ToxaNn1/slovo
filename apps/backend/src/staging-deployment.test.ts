import type { AnalyticsQuery, Clock } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { ServerConfigSchema } from './config';
import { deploymentPorts } from './deployment-ports';

const clock: Clock = { now: () => new Date('2026-11-17T10:00:00Z') };

const BASE_ENV = {
  DATABASE_URL: 'postgres://slovo:slovo@localhost:5432/slovo',
  AUTH_SECRET: 'a-test-secret-that-is-at-least-32-characters',
  NODE_ENV: 'production',
  ZEPTOMAIL_TOKEN: 'a-send-mail-token',
  MAIL_FROM: 'no-reply@example.com',
  MEDIA_BASE: 'https://media.example.com',
  TRUSTED_PROXY_HOPS: '1',
};

const POSTHOG_ENV = { POSTHOG_PERSONAL_API_KEY: 'phx_key', POSTHOG_PROJECT_ID: '12345' };

const R2_ENV = {
  R2_ACCOUNT_ID: 'account',
  R2_BUCKET: 'media',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
};

const QUERY: AnalyticsQuery = {
  kind: 'activeByDay',
  editionIds: ['uk'],
  period: { from: '2026-11-01', to: '2026-11-17' },
};

/** A fetch that records every request and answers each with the given status. */
function recordingFetch(status = 200) {
  const requests: { method: string; url: string }[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    requests.push({
      method: init?.method ?? 'GET',
      url: input instanceof Request ? input.url : input.toString(),
    });
    return Promise.resolve(new Response(status === 200 ? '{"results":[]}' : null, { status }));
  };
  return { requests, fetch };
}

/** The ports a backend with this environment runs with, and what they send. */
function portsOf(env: Record<string, string>, status?: number) {
  const network = recordingFetch(status);
  const ports = deploymentPorts(ServerConfigSchema.parse(env), { clock, fetch: network.fetch });
  return { ...ports, requests: network.requests };
}

/** The variables a config refuses, each with its message. */
function refusalsOf(env: Record<string, string>) {
  const result = ServerConfigSchema.safeParse(env);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('the Staging Deployment', () => {
  const STAGING_ENV = { ...BASE_ENV, DEPLOYMENT: 'staging' };

  it('starts with no R2 keys and no PostHog key, though NODE_ENV is production', () => {
    expect(refusalsOf(STAGING_ENV)).toEqual([]);
  });

  it('sends no Analytics query: PostHog answers unavailable and nothing leaves', async () => {
    const staging = portsOf(STAGING_ENV);

    expect(await staging.posthog.query(QUERY)).toEqual({ ok: false });
    expect(staging.requests).toEqual([]);
  });

  it('writes nothing to the Media Store: a put and a delete are refused and nothing leaves', async () => {
    const staging = portsOf(STAGING_ENV);

    await expect(
      staging.mediaStore.put('illustrations/1-abc.png', new Uint8Array([1]), 'image/png'),
    ).rejects.toThrow('writes nothing to the Media Store');
    await expect(staging.mediaStore.delete('illustrations/1-abc.png')).rejects.toThrow(
      'writes nothing to the Media Store',
    );
    expect(staging.requests).toEqual([]);
  });

  it("reads a file at the Media Store's public URL, never through R2", async () => {
    const found = portsOf(STAGING_ENV);
    const missing = portsOf(STAGING_ENV, 404);

    expect(await found.mediaStore.head('recordings/a.mp3')).toBeDefined();
    expect(await missing.mediaStore.head('recordings/a.mp3')).toBeUndefined();
    expect(found.requests).toEqual([
      { method: 'HEAD', url: 'https://media.example.com/recordings/a.mp3' },
    ]);
  });

  it('refuses the PostHog and R2 keys, naming each', () => {
    expect(refusalsOf({ ...STAGING_ENV, ...POSTHOG_ENV, ...R2_ENV }).sort()).toEqual(
      [...Object.keys(POSTHOG_ENV), ...Object.keys(R2_ENV)]
        .map((name) => `${name}: must not be set on the Staging Deployment`)
        .sort(),
    );
  });

  it('refuses a VAULT_KEY that is the AUTH_SECRET, as the Deployment does', () => {
    const secret = Buffer.alloc(32, 7).toString('base64');

    expect(refusalsOf({ ...STAGING_ENV, AUTH_SECRET: secret, VAULT_KEY: secret })).toEqual([
      'VAULT_KEY: must not be the AUTH_SECRET',
    ]);
  });

  it('tags its Sentry reports with the environment `staging`', () => {
    expect(portsOf(STAGING_ENV).sentryEnvironment).toBe('staging');
  });
});

describe('the Deployment', () => {
  const PRODUCTION_ENV = { ...BASE_ENV, ...POSTHOG_ENV, ...R2_ENV };

  it('queries PostHog and writes to R2, as the Staging Deployment does not', async () => {
    const production = portsOf(PRODUCTION_ENV);

    await production.posthog.query(QUERY);
    await production.mediaStore.put('illustrations/1-abc.png', new Uint8Array([1]), 'image/png');

    expect(production.requests).toEqual([
      { method: 'POST', url: 'https://eu.posthog.com/api/projects/12345/query/' },
      {
        method: 'PUT',
        url: 'https://account.r2.cloudflarestorage.com/media/illustrations/1-abc.png',
      },
    ]);
  });

  it('refuses to start in production with no trusted proxy hop, which would put every reader behind one IP', () => {
    const { TRUSTED_PROXY_HOPS: _hops, ...unset } = PRODUCTION_ENV;

    expect(refusalsOf(unset)).toEqual(['TRUSTED_PROXY_HOPS: must be 1 or more in production']);
    expect(refusalsOf({ ...PRODUCTION_ENV, TRUSTED_PROXY_HOPS: '0' })).toEqual([
      'TRUSTED_PROXY_HOPS: must be 1 or more in production',
    ]);
  });

  it('tags its Sentry reports with the environment `production`', () => {
    expect(portsOf(PRODUCTION_ENV).sentryEnvironment).toBe('production');
  });
});
