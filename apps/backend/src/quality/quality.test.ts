import { createAdminAccess, systemClock } from '@slovo/server-core';
import { describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import {
  TEST_CI_TOKEN,
  createTestDatabase,
  passTime,
  signedInAdmin,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** The backend on a database of the test's own, with a Власник signed in. */
async function backendWithOwner() {
  const own = await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  const backend = testApp({ database });
  const owner = await signedInAdmin(backend, 'owner');
  return { ...backend, owner, database };
}

/** A CI run on `main` as CI pushes it. */
const runOf = (runId: number, daysAgo: number, failedTests: string[]) => ({
  runId,
  at: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
  sha: `${String(runId)}abcdef0`,
  tests: 120,
  failedTests,
  coverage: [{ package: '@slovo/core', lines: 90 + runId, branches: 80 + runId }],
  jobs: [{ name: 'checks', seconds: 300 + runId }],
});

const push = (backend: ReturnType<typeof testApp>, run: unknown, headers: Record<string, string>) =>
  backend.request('/v1/admin/ci-runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(run),
  });

const ci = { authorization: `Bearer ${TEST_CI_TOKEN}` };

describe('the CI history', () => {
  it('keeps each run CI pushes once and answers coverage, flaky tests and durations over time', async () => {
    const backend = await backendWithOwner();
    expect((await push(backend, runOf(2, 1, []), ci)).status).toBe(200);
    expect((await push(backend, runOf(1, 2, ['core > draws a card']), ci)).status).toBe(200);
    expect((await push(backend, runOf(1, 2, ['another']), ci)).status).toBe(200);
    expect((await push(backend, runOf(3, 40, ['core > draws a card']), ci)).status).toBe(200);

    const { runs } = await backend.owner.client.admin.ciHistory({ period: '7d' });

    expect(runs.map((run) => run.runId)).toEqual([1, 2]);
    expect(runs[0]).toMatchObject({
      failedTests: ['core > draws a card'],
      flakyTests: ['core > draws a card'],
      coverage: [{ package: '@slovo/core', lines: 91, branches: 81 }],
      jobs: [{ name: 'checks', seconds: 301 }],
    });
    expect(runs[1]).toMatchObject({ flakyTests: [], jobs: [{ name: 'checks', seconds: 302 }] });
  });

  it('refuses a push without the CI token, with an Агент token or an admin session', async () => {
    const backend = await backendWithOwner();
    const admin = createAdminAccess({
      store: createAdminStore(backend.database),
      clock: systemClock,
      random: systemRandom,
      hash: hashToken,
    });
    const out: string[] = [];
    await runAdminCommand(['agent', 'add', 'claude-content'], admin, {
      out: (line) => out.push(line),
      err: () => undefined,
    });
    const agent = out.find((line) => line.startsWith('slovo_agent_')) ?? '';
    expect(agent).not.toBe('');

    for (const headers of [
      {},
      { authorization: 'Bearer a-wrong-token' },
      { authorization: `Bearer ${agent}` },
      { cookie: backend.owner.cookie, 'x-slovo-admin': '1' },
    ]) {
      expect((await push(backend, runOf(9, 0, []), headers)).status).toBe(401);
    }
    expect((await backend.owner.client.admin.ciHistory({ period: '1d' })).runs).toEqual([]);
  });
});

describe('the Sentry numbers of Якість', () => {
  it("answers the period's numbers with the day before's and when they were read", async () => {
    const backend = await backendWithOwner();
    backend.sentry.set('crashFree', 99.5);
    backend.sentry.set('crashFree', 98, 'yesterday');
    backend.sentry.set('newIssues', 0);
    const now = new Date();

    const answer = await backend.owner.client.admin.quality({ period: '7d' });

    expect(answer.capped).toBe(false);
    expect(new Date(answer.to).getTime() - new Date(answer.from).getTime()).toBe(7 * DAY_MS);
    expect(answer.kpis.crashFree).toEqual({
      state: 'ok',
      value: 99.5,
      yesterday: 98,
      fetchedAt: now.toISOString(),
    });
    expect(answer.kpis.newIssues).toMatchObject({ state: 'ok', value: 0 });
    expect(answer.kpis.backendP95).toMatchObject({ state: 'ok', value: null });
  });

  it('cuts a period over 30 days to 30 and says so', async () => {
    const backend = await backendWithOwner();

    const answer = await backend.owner.client.admin.quality({ period: '90d' });

    expect(answer.capped).toBe(true);
    expect(new Date(answer.to).getTime() - new Date(answer.from).getTime()).toBe(30 * DAY_MS);
    const oldest = Math.min(...backend.sentry.asked.map((window) => window.from.getTime()));
    expect(Date.now() - oldest).toBe(31 * DAY_MS);
  });

  it('serves the kept numbers while Sentry limits the reads and asks again only once it allows', async () => {
    const backend = await backendWithOwner();
    backend.sentry.set('crashes', 4);
    const read = () => backend.owner.client.admin.quality({ period: '1d' });
    const first = await read();
    passTime(6 * MINUTE_MS);
    backend.sentry.limit(new Date(Date.now() + 10 * MINUTE_MS));

    expect((await read()).kpis.crashes).toEqual(first.kpis.crashes);
    const asked = backend.sentry.asked.length;
    passTime(5 * MINUTE_MS);
    expect((await read()).kpis.crashes).toEqual(first.kpis.crashes);
    expect(backend.sentry.asked).toHaveLength(asked);

    passTime(6 * MINUTE_MS);
    backend.sentry.limit(undefined);
    const fresh = await read();
    expect(fresh.kpis.crashes).toEqual({
      state: 'ok',
      value: 4,
      yesterday: null,
      fetchedAt: new Date().toISOString(),
    });
  });

  it('answers unavailable while Sentry has never been read', async () => {
    const backend = await backendWithOwner();
    backend.sentry.limit(new Date(Date.now() + MINUTE_MS));

    const answer = await backend.owner.client.admin.quality({ period: '1d' });

    expect(answer.kpis.errors).toEqual({ state: 'unavailable' });
  });
});
