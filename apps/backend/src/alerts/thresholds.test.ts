import { createMonitor, thresholdsOf, type OwnerMessage } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { createFakePostHog } from '../analytics/fake-posthog';
import { signedInAdmin, testApp } from '../test-support';
import { createAlertStore, createAlertThresholdStore } from './alert-store';

describe('the alert thresholds', () => {
  it('change only with a reason, in the action log, and the next run uses them', async () => {
    const backend = testApp();
    const { client, email } = await signedInAdmin(backend, 'owner');

    await expect(
      client.admin.setAlertThreshold({ key: 'crashFree', value: 99, reason: ' ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await client.admin.setAlertThreshold({ key: 'crashFree', value: 99, reason: 'too noisy' });

    const { thresholds } = await client.admin.alertThresholds();
    expect(thresholds.find(({ key }) => key === 'crashFree')).toEqual({
      key: 'crashFree',
      value: 99,
      default: 99.5,
    });
    const { actions } = await client.admin.actions({});
    expect(actions.filter(({ what }) => what === 'alert-threshold.set')).toMatchObject([
      {
        who: { kind: 'admin-user', email },
        before: { key: 'crashFree', value: 99.5 },
        after: { key: 'crashFree', value: 99 },
        reason: 'too noisy',
      },
    ]);

    // The Cron service's next run reads the thresholds from the database.
    let crashFree = 99.4;
    const sent: OwnerMessage[] = [];
    const store = createAlertThresholdStore(backend.database);
    const monitor = createMonitor({
      settings: { thresholds: () => thresholdsOf(store) },
      store: createAlertStore(backend.database),
      chat: {
        send: (message) => {
          sent.push(message);
          return Promise.resolve(true);
        },
      },
      sentry: {
        read: (read) =>
          Promise.resolve({ ok: true, value: read === 'crashFree' ? crashFree : null }),
      },
      posthog: createFakePostHog(),
      ciRuns: { between: () => Promise.resolve([]) },
      health: { up: () => Promise.resolve(true) },
      batches: { open: () => Promise.resolve([]) },
      editionIds: ['uk'],
      // 05:00 Kyiv: before the digest.
      clock: { now: () => new Date('2026-11-20T03:00:00Z') },
    });
    await monitor.run();
    expect(sent).toEqual([]);

    crashFree = 98.9;
    await monitor.run();
    expect(sent).toEqual([
      { kind: 'alert', alert: { kind: 'crash-free', percent: 98.9, threshold: 99 } },
    ]);
    expect((await client.admin.latestAlerts()).alerts).toMatchObject([
      {
        kind: 'crash-free',
        text: '📉 Сесій без падінь за 24 год: 98,9 % (поріг 99 %).',
        sentAt: '2026-11-20T03:00:00.000Z',
      },
    ]);
  });
});
