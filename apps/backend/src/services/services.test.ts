import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { adminHeaders, passTime, signedInAdmin, testApp } from '../test-support';
import { pino } from 'pino';
import { SERVICE_BLOCK } from '@slovo/contracts/admin-api';

import { createFakeUsage } from './fake-usage';
import { createCloudflareUsage, createGitHubActionsUsage, createNeonUsage } from './usage-sources';

/** A backend whose admin is on, with a signed-in Власник. */
async function ownerOn() {
  const backend = testApp();
  return { ...backend, owner: await signedInAdmin(backend, 'owner') };
}

const ELEVEN = [
  'Apple Developer / App Store Connect',
  'Cloudflare',
  'Expo/EAS',
  'GitHub',
  'Google Play',
  'Neon',
  'PostHog',
  'Railway',
  'Sentry',
  'Telegram bot',
  'Zoho Mail',
];

/** The five social accounts and where each one's profile is. */
const ACCOUNTS = [
  ['Instagram', 'https://instagram.com/slovoapp_official'],
  ['Threads', 'https://threads.com/@slovoapp_official'],
  ['TikTok', 'https://tiktok.com/@slovoapp_official'],
  ['YouTube', 'https://youtube.com/@slovoapp_official'],
  ['Telegram channel', 'https://t.me/slovoapp_official'],
] as const;

describe('«Сервіси»', () => {
  it('answers a Власник the eleven known Services with their places and links', async () => {
    const backend = await ownerOn();

    const { services } = await backend.owner.client.admin.services.list();

    expect(services.map((service) => service.name)).toEqual(
      [...ELEVEN, ...ACCOUNTS.map(([name]) => name)].sort(),
    );
    const byName = new Map(services.map((service) => [service.name, service]));
    const idOf = (name: string) => byName.get(name)?.id;
    expect(byName.get('Railway')).toMatchObject({
      kind: 'railway',
      plan: null,
      monthlyPriceUsdCents: null,
      billingDay: null,
      limits: [],
      position: { x: 640, y: 260 },
    });
    expect(byName.get('Railway')?.links).toEqual([
      { to: idOf('Neon'), kind: 'constant' },
      { to: idOf('Sentry'), kind: 'constant' },
      { to: idOf('PostHog'), kind: 'constant' },
      { to: idOf('Zoho Mail'), kind: 'constant' },
      { to: idOf('Telegram bot'), kind: 'scheduled' },
    ]);
    expect(byName.get('GitHub')?.links).toEqual([
      { to: idOf('Railway'), kind: 'constant' },
      { to: idOf('Cloudflare'), kind: 'constant' },
    ]);
    // Every place is its own.
    const places = new Set(
      services.map(({ position }) => `${String(position.x)},${String(position.y)}`),
    );
    expect(places.size).toBe(16);
  });

  it('answers the five social accounts in a column of their own, with their open entries and no usage', async () => {
    const backend = await ownerOn();
    const { services } = await backend.owner.client.admin.services.list();
    const known = services.filter(({ name }) => ELEVEN.includes(name));
    const right = Math.max(...known.map(({ position }) => position.x)) + SERVICE_BLOCK.width;

    for (const [name, profile] of ACCOUNTS) {
      const service = services.find((each) => each.name === name);
      expect(service).toMatchObject({ kind: 'metered', limits: [], links: [], plan: null });
      expect(service?.position.x).toBeGreaterThan(right);
      const { entries } = await backend.owner.client.admin.services.entries({
        serviceId: service?.id ?? '',
      });
      expect(entries).toMatchObject([
        { type: 'link', label: 'Профіль', note: null, value: profile },
        {
          type: 'login',
          label: 'Нік',
          note: null,
          value: '@slovoapp_official',
        },
        {
          type: 'login',
          label: 'Пошта для входу',
          note: name === 'YouTube' ? 'вхід через Google' : null,
          value: 'accounts@slovoapp.org',
        },
      ]);
    }
    const accountIds = new Set(
      services
        .filter(({ name }) => ACCOUNTS.some(([account]) => account === name))
        .map(({ id }) => id),
    );
    const { usage } = await backend.owner.client.admin.services.usage();
    expect(usage.filter(({ serviceId }) => accountIds.has(serviceId))).toEqual([]);
  });

  it('refuses an Адмін and an Агент', async () => {
    const backend = await ownerOn();
    const admin = await signedInAdmin(backend, 'admin');
    const { token } = await backend.owner.client.admin.issueAgentToken({
      name: `agent-${randomUUID().slice(0, 8)}`,
      reason: 'content batches',
    });

    await expect(admin.client.admin.services.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const agent = await backend.request('/v1/admin/services', {
      headers: { ...adminHeaders(), authorization: `Bearer ${token}` },
    });
    expect(agent.status).toBe(403);
    const anyone = await backend.request('/v1/admin/services', { headers: adminHeaders() });
    expect(anyone.status).toBe(401);
  });
});

describe('the usage of «Сервіси»', () => {
  const HOUR = 60 * 60 * 1000;

  /** A backend with faked Sentry and PostHog usage ports, a signed-in Власник, and the Services' ids. */
  async function withUsage() {
    const sentry = createFakeUsage('errors', 'events', 1200, 5000);
    const posthog = createFakeUsage('events', 'events', 250_000, 1_000_000);
    const backend = testApp({ usage: { Sentry: sentry, PostHog: posthog } });
    const owner = await signedInAdmin(backend, 'owner');
    const { services } = await owner.client.admin.services.list();
    const idOf = (name: string) => services.find((service) => service.name === name)?.id ?? '';
    const usageOf = async (name: string) =>
      (await owner.client.admin.services.usage()).usage.find(
        ({ serviceId }) => serviceId === idOf(name),
      )?.read;
    return { backend, owner, sentry, posthog, idOf, usageOf };
  }

  it('answers the Sentry and PostHog usage per limit with its read time', async () => {
    const { owner, idOf } = await withUsage();
    const readAt = new Date().toISOString();

    const { usage } = await owner.client.admin.services.usage();

    expect(usage).toHaveLength(2);
    expect(usage).toContainEqual({
      serviceId: idOf('Sentry'),
      read: {
        state: 'read',
        reading: {
          kind: 'metered',
          usage: [{ name: 'errors', unit: 'events', used: 1200, limit: 5000 }],
        },
        readAt,
        stale: false,
      },
    });
    expect(usage).toContainEqual({
      serviceId: idOf('PostHog'),
      read: {
        state: 'read',
        reading: {
          kind: 'metered',
          usage: [{ name: 'events', unit: 'events', used: 250_000, limit: 1_000_000 }],
        },
        readAt,
        stale: false,
      },
    });
  });

  it('keeps a reading for an hour, then reads the provider again', async () => {
    const { sentry, usageOf } = await withUsage();
    await usageOf('Sentry');
    sentry.set({
      kind: 'metered',
      usage: [{ name: 'errors', unit: 'events', used: 1300, limit: 5000 }],
    });

    passTime(HOUR - 1);
    expect(await usageOf('Sentry')).toMatchObject({
      reading: { usage: [{ used: 1200 }] },
    });
    expect(sentry.calls).toBe(1);

    passTime(1);
    expect(await usageOf('Sentry')).toMatchObject({
      reading: { usage: [{ used: 1300 }] },
      readAt: new Date().toISOString(),
    });
    expect(sentry.calls).toBe(2);
  });

  it('reads the provider again on «Оновити», within the hour', async () => {
    const { owner, sentry, idOf, usageOf } = await withUsage();
    await usageOf('Sentry');
    sentry.set({
      kind: 'metered',
      usage: [{ name: 'errors', unit: 'events', used: 1300, limit: 5000 }],
    });
    passTime(60_000);

    const { usage } = await owner.client.admin.services.refreshUsage({
      serviceId: idOf('Sentry'),
    });

    expect(usage).toMatchObject({
      serviceId: idOf('Sentry'),
      read: { reading: { usage: [{ used: 1300 }] }, readAt: new Date().toISOString() },
    });
    expect(await usageOf('Sentry')).toMatchObject({ reading: { usage: [{ used: 1300 }] } });
    expect(sentry.calls).toBe(2);
  });

  it('keeps the last reading, marked stale, when a read fails', async () => {
    const { owner, sentry, idOf, usageOf } = await withUsage();
    const readAt = new Date().toISOString();
    await usageOf('Sentry');
    sentry.fail();

    const { usage } = await owner.client.admin.services.refreshUsage({
      serviceId: idOf('Sentry'),
    });

    expect(usage.read).toMatchObject({
      state: 'read',
      reading: { usage: [{ used: 1200 }] },
      readAt,
      stale: true,
    });
  });

  it('answers unavailable while no read has succeeded', async () => {
    const { posthog, usageOf } = await withUsage();
    posthog.fail();

    expect(await usageOf('PostHog')).toEqual({ state: 'unavailable' });
  });

  it('refuses «Оновити» for a Service without a usage read', async () => {
    const { owner, idOf } = await withUsage();

    await expect(
      owner.client.admin.services.refreshUsage({ serviceId: idOf('Zoho Mail') }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses the usage and «Оновити» to an Адмін', async () => {
    const { backend, idOf } = await withUsage();
    const admin = await signedInAdmin(backend, 'admin');

    await expect(admin.client.admin.services.usage()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      admin.client.admin.services.refreshUsage({ serviceId: idOf('Sentry') }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('the Neon, GitHub Actions and Cloudflare usage', () => {
  /** Fake providers, each answering its API's shape, and the hosts asked. */
  function fakeProviders() {
    const asked: string[] = [];
    const answers: Record<string, unknown> = {
      'console.neon.tech': {
        project: {
          compute_time_seconds: 36_000,
          synthetic_storage_size: 100_000_000,
          data_transfer_bytes: 4_750_000_000,
        },
      },
      'api.github.com': {
        usageItems: [{ product: 'actions', unitType: 'Minutes', quantity: 1200 }],
      },
      'api.cloudflare.com': {
        data: {
          viewer: {
            accounts: [
              {
                r2StorageAdaptiveGroups: [{ max: { payloadSize: 3_000_000_000, metadataSize: 0 } }],
                r2OperationsAdaptiveGroups: [
                  { sum: { requests: 10_000 }, dimensions: { actionType: 'PutObject' } },
                  { sum: { requests: 2_000_000 }, dimensions: { actionType: 'GetObject' } },
                ],
                workersInvocationsAdaptive: [{ sum: { requests: 40_000 } }],
              },
            ],
          },
        },
      },
    };
    const fetch: typeof globalThis.fetch = (input) => {
      const { host } = new URL(input instanceof Request ? input.url : input.toString());
      asked.push(host);
      return Promise.resolve(
        Response.json(answers[host] ?? {}, { status: host in answers ? 200 : 404 }),
      );
    };
    return { fetch, asked };
  }

  it('answers a usage bar per limit from each of the three providers', async () => {
    const { fetch, asked } = fakeProviders();
    const logger = pino({ level: 'silent' });
    const clock = { now: () => new Date() };
    const backend = testApp({
      usage: {
        Neon: createNeonUsage({ apiKey: 'a-fake-key', projectId: 'p', logger, fetch }),
        GitHub: createGitHubActionsUsage({
          token: 'a-fake-token',
          repository: 'ToxaNn1/slovo',
          clock,
          logger,
          fetch,
        }),
        Cloudflare: createCloudflareUsage({
          token: 'a-fake-token',
          accountId: 'a-fake-account',
          bucket: 'slovo-media',
          clock,
          logger,
          fetch,
        }),
      },
    });
    const owner = await signedInAdmin(backend, 'owner');
    const { services } = await owner.client.admin.services.list();
    const nameOf = (id: string) => services.find((service) => service.id === id)?.name;

    const { usage } = await owner.client.admin.services.usage();

    const bars = Object.fromEntries(
      usage.map(({ serviceId, read }): [string, unknown] => [
        nameOf(serviceId) ?? serviceId,
        read.state === 'read' && read.reading.kind === 'metered' ? read.reading.usage : [],
      ]),
    );
    expect(bars).toEqual({
      Neon: [
        { name: 'compute', unit: 'CU-hours', used: 10, limit: 100 },
        { name: 'storage', unit: 'GB', used: 0.1, limit: 0.5 },
        { name: 'egress', unit: 'GB', used: 4.75, limit: 5 },
      ],
      GitHub: [{ name: 'minutes', unit: 'minutes', used: 1200, limit: 2000 }],
      Cloudflare: [
        { name: 'r2-storage', unit: 'GB', used: 3, limit: 10 },
        { name: 'r2-class-a', unit: 'operations', used: 10_000, limit: 1_000_000 },
        { name: 'r2-class-b', unit: 'operations', used: 2_000_000, limit: 10_000_000 },
        { name: 'worker-requests', unit: 'requests', used: 40_000, limit: 100_000 },
      ],
    });
    expect(asked.toSorted()).toEqual([
      'api.cloudflare.com',
      'api.github.com',
      'api.github.com',
      'console.neon.tech',
    ]);

    await owner.client.admin.services.usage();
    expect(asked).toHaveLength(4);
  });
});
