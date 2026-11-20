import { describe, expect, it } from 'vitest';

import { PACK_FORMAT } from '@slovo/language-pack';
import { systemClock } from '@slovo/server-core';

import { createEditions } from '../edition/editions';
import { passTime, signedInAdmin, testApp, testEditions } from '../test-support';

/** A backend over one Edition that ships `contentUpdates` off, its Власник signed in. */
async function adminOn(id: string) {
  const folder = testEditions([id], (config) => ({
    ...config,
    featureSwitches: { ...config.featureSwitches, contentUpdates: 'off' },
  }));
  const app = testApp({ editions: folder.read() });
  const owner = await signedInAdmin(app, 'owner');
  const editions = createEditions({
    database: app.database,
    clock: systemClock,
    editions: folder.read(),
    alerts: app.alerts,
  });
  const latest = () => owner.client.content.latest({ editionId: id, packFormat: PACK_FORMAT });
  return { client: owner.client, editions, latest };
}

const HOUR = 60 * 60 * 1000;
const at = (offset: number) => new Date(Date.now() + offset).toISOString();

// ADR 0089: the backend holds a feature on while it is on for anyone, by the
// backend's clock, which corrects the device's.
describe('a scheduled Rule the admin sets', () => {
  it('serves the feature only while its schedule holds', async () => {
    const { client, latest } = await adminOn('window');
    await client.admin.setRules({
      editionId: 'window',
      feature: 'contentUpdates',
      rules: [
        {
          id: 'week',
          verdict: 'on',
          targets: { schedule: { from: at(HOUR), until: at(3 * HOUR) } },
        },
      ],
      reason: 'Patches for a week',
    });

    await expect(latest()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    passTime(2 * HOUR);
    await expect(latest()).resolves.toEqual({ pack: null });
    passTime(2 * HOUR);
    await expect(latest()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('turns off for everyone a feature the Edition has on while an off schedule holds', async () => {
    const { client, latest } = await adminOn('pause');
    await client.admin.setRules({
      editionId: 'pause',
      feature: 'contentUpdates',
      rules: [
        { id: 'pause', verdict: 'off', targets: { schedule: { until: at(HOUR) } } },
        { id: 'all', verdict: 'on', targets: {} },
      ],
      reason: 'no Patches before the release',
    });

    await expect(latest()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    passTime(2 * HOUR);
    await expect(latest()).resolves.toEqual({ pack: null });
  });
});

describe('Rules that only turn a feature off', () => {
  it('are taken while a switch the feature depends on is off for everyone', async () => {
    const { client, editions } = await adminOn('parent');
    await editions.kill('xpLog', 'parent', {
      who: { kind: 'command', command: 'test' },
      reason: 'xp bug',
    });

    const taken = await client.admin.setRules({
      editionId: 'parent',
      feature: 'badges',
      rules: [{ id: 'off', verdict: 'off', targets: { platform: 'ios' } }],
      reason: 'keep badges off on iOS',
    });
    expect(taken.rules.filter((rule) => rule.feature === 'badges')).toMatchObject([
      { id: 'off', verdict: 'off' },
    ]);
    await expect(
      client.admin.setRules({
        editionId: 'parent',
        feature: 'badges',
        rules: [{ id: 'on', verdict: 'on', targets: {} }],
        reason: 'badges for everyone',
      }),
    ).rejects.toMatchObject({ data: { refusal: 'dependency-off', feature: 'xpLog' } });
  });
});
