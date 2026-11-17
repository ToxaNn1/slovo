import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { createFakeRailway } from './fake-railway';
import { createRailwayUsage } from './railway-usage';

const logger = pino({ level: 'silent' });
const clock = { now: () => new Date('2026-11-17T09:30:00.000Z') };
const settings = { token: 'a-fake-token', projectId: 'project-1', environmentId: 'production' };

describe('the Railway usage', () => {
  it('answers the backend Online with the spend against the plan, and each Cron’s runs', async () => {
    const railway = createFakeRailway();
    const ports = createRailwayUsage({ settings, clock, logger, fetch: railway.fetch });

    expect(await ports.Railway.read()).toEqual({
      ok: true,
      value: {
        kind: 'railway',
        state: 'online',
        usage: [{ name: 'spend', unit: 'USD', used: 1.8, limit: 5 }],
      },
    });
    expect(await ports.alerts.read()).toEqual({
      ok: true,
      value: {
        kind: 'cron',
        lastRun: { at: new Date('2026-11-17T09:15:40.000Z'), succeeded: true },
        nextRunAt: new Date('2026-11-17T09:45:00.000Z'),
      },
    });
    expect(await ports['quote-check'].read()).toMatchObject({
      value: { lastRun: { succeeded: false } },
    });
    expect(await ports.recordings.read()).toMatchObject({ value: { lastRun: null } });
    const [asked] = railway.asked;
    expect(asked?.headers.get('authorization')).toBe('Bearer a-fake-token');
    expect(asked?.variables).toEqual({
      projectId: 'project-1',
      startDate: '2026-11-01T00:00:00.000Z',
    });
  });

  it('answers the backend Offline while its latest deployment is not up', async () => {
    const railway = createFakeRailway();
    railway.setBackend('CRASHED');
    const ports = createRailwayUsage({ settings, clock, logger, fetch: railway.fetch });

    expect(await ports.Railway.read()).toMatchObject({ value: { state: 'offline' } });
  });

  it('asks Railway once for the backend and every Cron read together', async () => {
    const railway = createFakeRailway();
    const ports = createRailwayUsage({ settings, clock, logger, fetch: railway.fetch });

    await Promise.all(Object.values(ports).map((port) => port.read()));
    expect(railway.asked).toHaveLength(1);

    await ports.Railway.read();
    expect(railway.asked).toHaveLength(2);
  });

  it('answers unavailable on a GraphQL error, a refusal or without a token', async () => {
    const railway = createFakeRailway();
    railway.fail();
    const failing = createRailwayUsage({ settings, clock, logger, fetch: railway.fetch });
    const unset = createRailwayUsage({ settings: undefined, clock, logger, fetch: railway.fetch });

    expect(await failing.alerts.read()).toEqual({ ok: false, reason: 'unavailable' });
    expect(await unset.Railway.read()).toEqual({ ok: false, reason: 'unavailable' });
  });
});
