import { describe, expect, it } from 'vitest';

import { PACK_FORMAT } from '@slovo/language-pack';
import { systemClock } from '@slovo/server-core';

import { createAdminStore } from '../admin/admin-store';
import { signedInAdmin, testApp, testEditions } from '../test-support';
import { createEditions } from './editions';
import { runSwitchesCommand } from './switches-command';

/**
 * A backend over the Editions, its admin API on: a Власник is in its database,
 * and `client` is the Власник's, signed in.
 */
async function adminOn(...ids: string[]) {
  const folder = testEditions(ids, (config) => ({
    ...config,
    featureSwitches: {
      ...config.featureSwitches,
      contentUpdates: 'off',
      mistakeReports: 'unavailable',
    },
  }));
  const app = testApp({ editions: folder.read() });
  const store = createAdminStore(app.database);
  const owner = await signedInAdmin(app, 'owner');
  const editions = createEditions({
    database: app.database,
    clock: systemClock,
    editions: folder.read(),
    alerts: app.alerts,
  });
  return { ...app, client: owner.client, owner, store, editions };
}

describe('Rules the admin sets', () => {
  it('reach edition.switches with the force-update minimums, under a new ETag', async () => {
    const { client } = await adminOn('ruled');
    const params = { editionId: 'ruled' };
    const before = await client.edition.switches({ params });

    await client.admin.setRules({
      editionId: 'ruled',
      feature: 'game',
      rules: [{ id: 'beta', verdict: 'off', targets: { platform: 'android', share: 50 } }],
      reason: 'try the Game on half of Android',
    });
    await client.admin.setMinimum({
      editionId: 'ruled',
      platform: 'ios',
      minimum: { soft: '1.2.0', hard: '1.0.0' },
      reason: 'old builds crash',
    });
    const after = await client.edition.switches({ params });
    const same = await client.edition.switches({
      params,
      headers: { 'if-none-match': after.headers.etag },
    });

    expect(after).toMatchObject({
      status: 200,
      body: {
        rules: [
          {
            id: 'beta',
            feature: 'game',
            verdict: 'off',
            targets: { platform: 'android', share: 50 },
          },
        ],
        minimums: { ios: { soft: '1.2.0', hard: '1.0.0' } },
      },
    });
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(same.status).toBe(304);
  });

  it('are refused for a feature the Edition has unavailable, and log nothing', async () => {
    const { client, store } = await adminOn('closed');

    await expect(
      client.admin.setRules({
        editionId: 'closed',
        feature: 'mistakeReports',
        rules: [{ id: 'on', verdict: 'on', targets: {} }],
        reason: 'open it',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      data: { refusal: 'unavailable-feature', feature: 'mistakeReports' },
    });
    await expect(store.actions('closed')).resolves.toEqual([]);
  });

  it('are refused for a feature whose switch it depends on is off for everyone, and log nothing more', async () => {
    const { client, store, editions } = await adminOn('orphan');
    await editions.kill('xpLog', 'orphan', {
      who: { kind: 'command', command: 'test' },
      reason: 'xp bug',
    });
    const logged = await store.actions('orphan');

    await expect(
      client.admin.setRules({
        editionId: 'orphan',
        feature: 'badges',
        rules: [{ id: 'on', verdict: 'on', targets: {} }],
        reason: 'badges for everyone',
      }),
    ).rejects.toMatchObject({ data: { refusal: 'dependency-off', feature: 'xpLog' } });
    await expect(store.actions('orphan')).resolves.toEqual(logged);
  });

  it('serve a feature the Edition has off while a Rule turns it on for some readers, and not for none', async () => {
    const { client } = await adminOn('share');
    const latest = () => client.content.latest({ editionId: 'share', packFormat: PACK_FORMAT });
    const share = (percent: number) =>
      client.admin.setRules({
        editionId: 'share',
        feature: 'contentUpdates',
        rules: [{ id: 'rollout', verdict: 'on', targets: { share: percent } }],
        reason: 'roll out',
      });

    await share(20);
    await expect(latest()).resolves.toEqual({ pack: null });
    await share(0);
    await expect(latest()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('the Kill switch through the admin API', () => {
  it('turns the feature off over every Rule, logs it and alerts the owner', async () => {
    const { client, store, alerts } = await adminOn('killed');
    await client.admin.setRules({
      editionId: 'killed',
      feature: 'game',
      rules: [{ id: 'all', verdict: 'on', targets: {} }],
      reason: 'everyone plays',
    });

    await expect(
      client.admin.kill({ feature: 'game', editionId: 'killed', reason: 'the Game loses scores' }),
    ).resolves.toEqual({ editionIds: ['killed'] });

    await expect(
      client.edition.switches({ params: { editionId: 'killed' } }),
    ).resolves.toMatchObject({
      body: { rules: [{ id: 'kill', feature: 'game', verdict: 'off', targets: {} }] },
    });
    await expect(store.actions('killed')).resolves.toContainEqual(
      expect.objectContaining({ what: 'switches.kill', reason: 'the Game loses scores' }),
    );
    expect(alerts.sent).toMatchObject([
      {
        kind: 'kill-switch',
        feature: 'game',
        editionIds: ['killed'],
        who: { kind: 'admin-user' },
        reason: 'the Game loses scores',
      },
    ]);
  });

  it('sends no alert for a refused kill', async () => {
    const { client, alerts } = await adminOn('kept');

    await expect(
      client.admin.kill({ feature: 'nothing', editionId: 'kept', reason: 'a typo' }),
    ).rejects.toThrow();
    expect(alerts.sent).toEqual([]);
  });

  it('skips the Editions that have the feature unavailable', async () => {
    const { client, alerts } = await adminOn('open');

    await expect(
      client.admin.kill({ feature: 'mistakeReports', reason: 'reports flood in' }),
    ).rejects.toThrow();
    expect(alerts.sent).toEqual([]);
  });
});

describe('the switches command', () => {
  it('turns a feature off for everyone and logs who and why', async () => {
    const { client, store, editions } = await adminOn('shell');
    const lines: string[] = [];
    const output = {
      out: (line: string) => lines.push(line),
      err: (line: string) => lines.push(line),
    };

    const code = await runSwitchesCommand(
      ['off', 'shell', 'game', '--reason', 'the Game loses scores'],
      editions,
      output,
    );

    expect(code).toBe(0);
    await expect(
      client.edition.switches({ params: { editionId: 'shell' } }),
    ).resolves.toMatchObject({
      body: { rules: [{ feature: 'game', verdict: 'off', targets: {} }] },
    });
    await expect(store.actions('shell')).resolves.toMatchObject([
      {
        who: { kind: 'command', command: 'switches off' },
        what: 'switches.kill',
        reason: 'the Game loses scores',
        editionId: 'shell',
      },
    ]);
  });

  it('refuses a run without a reason and switches nothing', async () => {
    const { store, editions } = await adminOn('quiet');
    const output = { out: () => undefined, err: () => undefined };

    await expect(runSwitchesCommand(['off', 'quiet', 'game'], editions, output)).resolves.toBe(2);
    await expect(store.actions('quiet')).resolves.toEqual([]);
  });
});
