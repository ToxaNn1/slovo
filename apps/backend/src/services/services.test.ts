import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { adminHeaders, signedInAdmin, testApp } from '../test-support';

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
