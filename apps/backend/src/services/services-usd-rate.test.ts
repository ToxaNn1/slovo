import { randomUUID } from 'node:crypto';

import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createDatabase } from '../database/database';
import {
  adminHeaders,
  createTestDatabase,
  signedInAdmin,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';

type Backend = ReturnType<typeof testApp>;

/** A backend on a database of the test's own, so no other test's rate is kept in it. */
async function ownBackend(): Promise<Backend> {
  const own = await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  return testApp({ database });
}

/** The rate a Власник reads at the moment, the backend's clock frozen there. */
async function rateAt(backend: Backend, iso: string) {
  vi.setSystemTime(new Date(iso));
  const owner = await signedInAdmin(backend, 'owner');
  return (await owner.client.admin.services.usdRate()).rate;
}

describe('«Сервіси»: the NBU rate of the dollar', () => {
  it('reads the NBU at most once a Kyiv day, and keeps the read across a restart', async () => {
    const backend = await ownBackend();
    backend.nbu.answer('2026-11-17', 41.4321);
    backend.nbu.answer('2026-11-18', 41.5);

    expect(await rateAt(backend, '2026-11-17T08:00:00Z')).toEqual({
      uahPerUsd: 41.4321,
      on: '2026-11-17',
      state: 'today',
    });
    // 23:30 in Kyiv is still the 17th.
    expect(await rateAt(backend, '2026-11-17T21:30:00Z')).toMatchObject({ on: '2026-11-17' });
    // A restart on the same database reads the kept rate.
    const restarted = testApp({ database: backend.database });
    expect(await rateAt(restarted, '2026-11-17T21:40:00Z')).toMatchObject({ uahPerUsd: 41.4321 });
    expect([...backend.nbu.asked, ...restarted.nbu.asked]).toEqual(['2026-11-17']);

    // 00:30 in Kyiv is the 18th: a new day, a new read.
    expect(await rateAt(backend, '2026-11-17T22:30:00Z')).toEqual({
      uahPerUsd: 41.5,
      on: '2026-11-18',
      state: 'today',
    });
    expect(backend.nbu.asked).toEqual(['2026-11-17', '2026-11-18']);
  });

  it('answers the last known rate with its day when the day’s read fails, and reads no second time that day', async () => {
    const backend = await ownBackend();
    backend.nbu.answer('2026-12-04', 42.1);
    expect(await rateAt(backend, '2026-12-04T10:00:00Z')).toMatchObject({ state: 'today' });

    backend.nbu.down(true);
    // A weekend passes unread; Monday's read fails.
    const lastKnown = { uahPerUsd: 42.1, on: '2026-12-04', state: 'last-known' };
    expect(await rateAt(backend, '2026-12-07T09:00:00Z')).toEqual(lastKnown);
    backend.nbu.down(false);
    backend.nbu.answer('2026-12-07', 42.3);
    expect(await rateAt(backend, '2026-12-07T15:00:00Z')).toEqual(lastKnown);
    // A restart on the same database keeps the failed read too.
    const restarted = testApp({ database: backend.database });
    expect(await rateAt(restarted, '2026-12-07T16:00:00Z')).toEqual(lastKnown);
    expect([...backend.nbu.asked, ...restarted.nbu.asked]).toEqual(['2026-12-04', '2026-12-07']);

    // The next day reads again.
    backend.nbu.answer('2026-12-08', 42.25);
    expect(await rateAt(backend, '2026-12-08T09:00:00Z')).toEqual({
      uahPerUsd: 42.25,
      on: '2026-12-08',
      state: 'today',
    });
  });

  it('answers no rate while no read ever found one', async () => {
    const backend = await ownBackend();
    backend.nbu.down(true);
    expect(await rateAt(backend, '2027-03-02T10:00:00Z')).toBeNull();
  });

  it('refuses an Адмін and an Агент', async () => {
    const backend = await ownBackend();
    const owner = await signedInAdmin(backend, 'owner');
    const admin = await signedInAdmin(backend, 'admin');
    const { token } = await owner.client.admin.issueAgentToken({
      name: `agent-${randomUUID().slice(0, 8)}`,
      reason: 'content batches',
    });

    await expect(admin.client.admin.services.usdRate()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const agent = await backend.request('/v1/admin/services/usd-rate', {
      headers: { ...adminHeaders(), authorization: `Bearer ${token}` },
    });
    expect(agent.status).toBe(403);
    expect(backend.nbu.asked).toEqual([]);
  });
});
