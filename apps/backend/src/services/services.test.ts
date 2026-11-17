import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { adminHeaders, passTime, signedInAdmin, testApp } from '../test-support';
import { createFakeUsage } from './fake-usage';

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

describe('«Сервіси»', () => {
  it('answers a Власник the eleven known Services with their places and links', async () => {
    const backend = await ownerOn();

    const { services } = await backend.owner.client.admin.services.list();

    expect(services.map((service) => service.name)).toEqual(ELEVEN);
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
    expect(places.size).toBe(11);
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
