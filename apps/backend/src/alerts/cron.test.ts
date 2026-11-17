import {
  ALERT_THRESHOLD_DEFAULTS,
  createMonitor,
  createServiceUsage,
  type CiRun,
  type LimitUsage,
  type OpenBatch,
  type OwnerMessage,
  type SentryAlertRead,
  type SentryRead,
} from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { createFakePostHog } from '../analytics/fake-posthog';
import { createDatabase } from '../database/database';
import { silentLogger, testDatabaseUrl } from '../test-support';
import { createAlertStore } from './alert-store';
import { openBatchesOf } from './cron-command';
import { alertText } from './owner-chat';

/**
 * A Cron service over this file's database, with fake Sentry, PostHog, CI,
 * health and content queue, and a chat that keeps every message. Each test
 * runs on days of its own, so the alerts other tests kept are older than the
 * 24 hours a run sends.
 */
function cron(start: string) {
  const database = createDatabase(testDatabaseUrl(), silentLogger);
  let now = new Date(start);
  const numbers = new Map<SentryRead | SentryAlertRead, number>();
  const periods = new Map<SentryRead | SentryAlertRead, { from: Date; to: Date }>();
  const runs: CiRun[] = [];
  const batches: OpenBatch[] = [];
  const sent: OwnerMessage[] = [];
  const posthog = createFakePostHog();
  const failures: string[] = [];
  let batchesFail = false;
  const clock = { now: () => now };
  const limits = new Map<string, LimitUsage[]>();
  let usageReads = 0;
  const usage = createServiceUsage({
    ports: Object.fromEntries(
      ['Sentry', 'Neon', 'alerts'].map((name) => [
        name,
        {
          read: () => {
            usageReads += 1;
            if (name === 'alerts') {
              return Promise.resolve({
                ok: true as const,
                value: { kind: 'cron' as const, lastRun: null, nextRunAt: null },
              });
            }
            const usage = limits.get(name);
            return Promise.resolve(
              usage === undefined
                ? { ok: false as const, reason: 'unavailable' as const }
                : { ok: true as const, value: { kind: 'metered' as const, usage } },
            );
          },
        },
      ]),
    ),
    clock,
  });
  const monitor = createMonitor({
    settings: { thresholds: () => Promise.resolve(ALERT_THRESHOLD_DEFAULTS) },
    store: createAlertStore(database),
    chat: {
      send: (message) => {
        sent.push(message);
        return Promise.resolve(true);
      },
    },
    sentry: {
      read: (read, period) => {
        periods.set(read, period);
        return Promise.resolve({ ok: true, value: numbers.get(read) ?? null });
      },
    },
    posthog,
    ciRuns: {
      between: (from, to) => Promise.resolve(runs.filter(({ at }) => at >= from && at <= to)),
    },
    health: { up: () => Promise.resolve(true) },
    batches: {
      open: () =>
        batchesFail ? Promise.reject(new Error('connection reset')) : Promise.resolve(batches),
    },
    usage,
    editionIds: ['uk'],
    logFailure: (message) => failures.push(message),
    clock,
  });
  return {
    sent,
    posthog,
    batches,
    runs,
    sentry: (read: SentryRead | SentryAlertRead, value: number) => numbers.set(read, value),
    periodOf: (read: SentryRead | SentryAlertRead) => periods.get(read),
    at: (time: string) => (now = new Date(time)),
    run: () => monitor.run(),
    failBatches: () => (batchesFail = true),
    failures,
    usage: (name: string, usage: LimitUsage[]) => limits.set(name, usage),
    usageReads: () => usageReads,
    alerts: () => sent.flatMap((message) => (message.kind === 'alert' ? [message.alert] : [])),
  };
}

const ciRun = (runId: number, at: string, failedTests: string[]): CiRun => ({
  runId,
  at: new Date(at),
  sha: `${String(runId).padStart(7, '0')}abcdef`,
  tests: 100,
  failedTests,
  coverage: [],
  jobs: [],
});

describe('the Cron service', () => {
  it('sends the digest of yesterday from 09:00 Kyiv, once, with its numbers', async () => {
    // 07:00 UTC is 09:00 in Kyiv in winter (UTC+2).
    const c = cron('2026-11-10T06:59:00Z');
    c.posthog.answer('activeByDay', [{ key: '2026-11-09', count: 42 }]);
    c.posthog.answer('visitsByDay', [{ key: '2026-11-09', count: 120 }]);
    c.sentry('crashes', 3);
    c.runs.push(ciRun(1, '2026-11-09T12:00:00Z', []));
    c.batches.push({ id: 'b-digest', editionId: 'uk', records: 7 });

    await c.run();
    expect(c.sent.filter(({ kind }) => kind === 'digest')).toEqual([]);

    c.at('2026-11-10T07:00:00Z');
    await c.run();
    // The Cron service runs hourly at :00 (.railway/railway.ts).
    c.at('2026-11-10T08:00:00Z');
    await c.run();
    expect(c.sent.filter(({ kind }) => kind === 'digest')).toEqual([
      {
        kind: 'digest',
        digest: {
          day: '2026-11-09',
          active: 42,
          visits: 120,
          crashes: 3,
          lastCi: { sha: '0000001abcdef', at: new Date('2026-11-09T12:00:00Z'), failedTests: 0 },
          openBatches: 1,
          openRecords: 7,
        },
      },
    ]);
  });

  it('reads the API errors of the hour before the run, and fires once an hour above 2 %', async () => {
    const c = cron('2026-11-18T05:00:00Z');
    c.sentry('backendErrorRate', 2.5);

    await c.run();
    expect(c.periodOf('backendErrorRate')).toEqual({
      from: new Date('2026-11-18T04:00:00Z'),
      to: new Date('2026-11-18T05:00:00Z'),
    });
    c.at('2026-11-18T05:30:00Z');
    await c.run();
    c.at('2026-11-18T06:00:00Z');
    await c.run();
    expect(c.alerts()).toEqual([
      { kind: 'api-errors', percent: 2.5, threshold: 2 },
      { kind: 'api-errors', percent: 2.5, threshold: 2 },
    ]);
  });

  it('fires the crash-free alert below 99.5 %, not above it', async () => {
    const above = cron('2026-11-12T03:00:00Z');
    above.sentry('crashFree', 99.6);
    await above.run();
    expect(above.alerts()).toEqual([]);

    const below = cron('2026-11-14T03:00:00Z');
    below.sentry('crashFree', 99.4);
    await below.run();
    await below.run();
    expect(below.alerts()).toEqual([{ kind: 'crash-free', percent: 99.4, threshold: 99.5 }]);
  });

  it('averages the activity over the days PostHog has, for an Edition younger than a week', async () => {
    const c = cron('2026-11-26T03:00:00Z');
    c.posthog.answer('activeByDay', [
      { key: '2026-11-23', count: 100 },
      { key: '2026-11-24', count: 100 },
      { key: '2026-11-25', count: 40 },
    ]);
    await c.run();
    expect(c.alerts()).toContainEqual({
      kind: 'activity-drop',
      day: '2026-11-25',
      active: 40,
      average: 100,
      threshold: 50,
    });
  });

  it('keeps the alerts of the other checks when one check throws, and logs it', async () => {
    const run = cron('2026-11-22T03:00:00Z');
    run.sentry('crashFree', 99.4);
    run.failBatches();
    await run.run();
    expect(run.alerts()).toEqual([{ kind: 'crash-free', percent: 99.4, threshold: 99.5 }]);
    expect(run.failures).toEqual(['alert check batch-size failed']);
  });

  it('fires the batch alert once for a batch of 201 records, not for 200', async () => {
    const c = cron('2026-11-16T03:00:00Z');
    c.batches.push(
      { id: 'b-200', editionId: 'uk', records: 200 },
      { id: 'b-201', editionId: 'uk', records: 201 },
    );
    await c.run();
    c.at('2026-11-16T03:15:00Z');
    await c.run();
    expect(c.alerts()).toEqual([
      { kind: 'batch-size', batchId: 'b-201', editionId: 'uk', records: 201, threshold: 200 },
    ]);
  });

  it('fires the CI alert for a red push to main, once', async () => {
    const c = cron('2026-11-18T03:00:00Z');
    c.runs.push(
      ciRun(10, '2026-11-18T01:00:00Z', []),
      ciRun(11, '2026-11-18T02:00:00Z', ['words › finds a rare word']),
    );
    await c.run();
    await c.run();
    expect(c.alerts()).toEqual([
      {
        kind: 'ci-red',
        runId: 11,
        sha: '0000011abcdef',
        failedTests: ['words › finds a rare word'],
      },
    ]);
  });

  it('fires the limit alert at 90 %, once per Service, limit and month, none below', async () => {
    // A month of its own: the alerts other tests kept have other keys.
    const c = cron('2027-01-05T10:00:00Z');
    c.usage('Sentry', [
      { name: 'errors', unit: 'errors', used: 4500, limit: 5000 },
      { name: 'replays', unit: 'replays', used: 49, limit: 50 },
    ]);
    c.usage('Neon', [{ name: 'storage', unit: 'GB', used: 0.449, limit: 0.5 }]);
    await c.run();
    c.at('2027-01-05T11:00:00Z');
    c.usage('Sentry', [
      { name: 'errors', unit: 'errors', used: 4900, limit: 5000 },
      { name: 'replays', unit: 'replays', used: 50, limit: 50 },
    ]);
    await c.run();
    expect(c.alerts()).toEqual([
      {
        kind: 'service-limit',
        service: 'Sentry',
        period: '2027-01',
        usage: { name: 'errors', unit: 'errors', used: 4500, limit: 5000 },
      },
      {
        kind: 'service-limit',
        service: 'Sentry',
        period: '2027-01',
        usage: { name: 'replays', unit: 'replays', used: 49, limit: 50 },
      },
    ]);

    expect(alertText(c.alerts()[0] ?? { kind: 'backend-down' })).toBe(
      '🟡 Sentry: ліміт «errors» використано на 90 % — 4\u00a0500 з 5\u00a0000 errors за 2027-01.',
    );

    c.at('2027-02-01T00:05:00Z');
    await c.run();
    expect(c.alerts().map((alert) => (alert.kind === 'service-limit' ? alert.period : ''))).toEqual(
      ['2027-01', '2027-01', '2027-02', '2027-02'],
    );
  });

  it('reads the usage once an hour, in the first run of the hour', async () => {
    const c = cron('2027-03-05T10:00:00Z');
    c.usage('Sentry', [{ name: 'errors', unit: 'errors', used: 4600, limit: 5000 }]);
    await c.run();
    expect(c.usageReads()).toBe(3);
    for (const minutes of ['15', '30', '45']) {
      c.at(`2027-03-05T10:${minutes}:00Z`);
      await c.run();
    }
    expect(c.usageReads()).toBe(3);
    expect(c.alerts()).toHaveLength(1);
  });

  it('counts the added and changed records of an open batch', async () => {
    const batches = openBatchesOf({
      batches: () =>
        Promise.resolve([
          {
            id: 'b-1',
            editionId: 'uk',
            author: 'agent-a',
            createdAt: '2026-11-01T00:00:00.000Z',
            added: 150,
            changed: 51,
          },
        ]),
    });
    expect(await batches.open()).toEqual([{ id: 'b-1', editionId: 'uk', records: 201 }]);
  });
});
