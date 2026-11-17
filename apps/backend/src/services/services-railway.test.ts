import { systemClock } from '@slovo/server-core';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { passTime, signedInAdmin, testApp } from '../test-support';
import { createFakeRailway } from './fake-railway';
import { createRailwayUsage } from './railway-usage';

const HOUR = 60 * 60 * 1000;

/**
 * A backend whose Railway usage ports read a fake Railway, a signed-in
 * Власник, the alerts Cron added as a Service, and each Service's usage.
 */
async function withRailway() {
  const railway = createFakeRailway();
  const backend = testApp({
    usage: createRailwayUsage({
      settings: { token: 'a-fake-token', projectId: 'project-1', environmentId: 'production' },
      clock: systemClock,
      logger: pino({ level: 'silent' }),
      fetch: railway.fetch,
    }),
  });
  const owner = await signedInAdmin(backend, 'owner');
  // The tests share a database: the first one adds the alerts Cron.
  if (!(await owner.client.admin.services.list()).services.some(({ name }) => name === 'alerts')) {
    await owner.client.admin.services.add({
      name: 'alerts',
      kind: 'cron',
      plan: null,
      monthlyPriceUsdCents: null,
      billingDay: null,
      reason: 'the alerts Cron on the canvas',
    });
  }
  const { services } = await owner.client.admin.services.list();
  const idOf = (name: string) => services.find((service) => service.name === name)?.id ?? '';
  const usageOf = async (name: string) =>
    (await owner.client.admin.services.usage()).usage.find(
      ({ serviceId }) => serviceId === idOf(name),
    )?.read;
  return { railway, owner, idOf, usageOf };
}

describe('Railway in «Сервіси»', () => {
  it('answers the backend Online with its spend, and the alerts Cron’s last and next run', async () => {
    const { owner, idOf } = await withRailway();

    const { usage } = await owner.client.admin.services.usage();

    expect(usage).toHaveLength(2);
    expect(usage).toContainEqual({
      serviceId: idOf('Railway'),
      read: {
        state: 'read',
        reading: {
          kind: 'railway',
          state: 'online',
          usage: [{ name: 'spend', unit: 'USD', used: 1.8, limit: 5 }],
          spendParts: [
            { part: 'cpu', usd: 0.56 },
            { part: 'memory', usd: 1.16 },
            { part: 'egress', usd: 0.09 },
            { part: 'disk', usd: 0 },
          ],
        },
        readAt: new Date().toISOString(),
        stale: false,
      },
    });
    expect(usage).toContainEqual({
      serviceId: idOf('alerts'),
      read: {
        state: 'read',
        reading: {
          kind: 'cron',
          lastRun: { at: '2026-11-17T09:15:40.000Z', succeeded: true },
          nextRunAt: '2026-11-17T09:45:00.000Z',
        },
        readAt: new Date().toISOString(),
        stale: false,
      },
    });
  });

  it('asks Railway once an hour for every block, and again on «Оновити»', async () => {
    const { railway, owner, usageOf, idOf } = await withRailway();
    await usageOf('Railway');
    expect(railway.asked).toHaveLength(1);

    passTime(HOUR - 1);
    await usageOf('Railway');
    expect(railway.asked).toHaveLength(1);

    railway.setBackend('CRASHED');
    const { usage } = await owner.client.admin.services.refreshUsage({
      serviceId: idOf('Railway'),
    });
    expect(usage.read).toMatchObject({ reading: { state: 'offline' }, stale: false });
    expect(railway.asked).toHaveLength(2);
  });

  it('keeps the last reading, marked stale, when Railway fails', async () => {
    const { railway, owner, idOf, usageOf } = await withRailway();
    const readAt = new Date().toISOString();
    await usageOf('alerts');
    railway.fail();
    passTime(60_000);

    const { usage } = await owner.client.admin.services.refreshUsage({ serviceId: idOf('alerts') });

    expect(usage.read).toMatchObject({
      state: 'read',
      reading: { kind: 'cron', lastRun: { succeeded: true } },
      readAt,
      stale: true,
    });
  });
});
