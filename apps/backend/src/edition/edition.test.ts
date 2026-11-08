import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PACK_FORMAT } from '@slovo/language-pack';

import { testApp, testEditions } from '../test-support';

const newEmail = () => `reader-${randomUUID()}@example.com`;

describe('the Editions', () => {
  it('are every Edition folder the backend finds at start', async () => {
    const { client } = testApp({ editions: testEditions(['uk', 'pl']).read() });

    for (const editionId of ['uk', 'pl']) {
      await expect(client.content.latest({ editionId, packFormat: PACK_FORMAT })).resolves.toEqual({
        pack: null,
      });
    }
  });

  it('refuse an Edition the backend did not find as NOT_FOUND', async () => {
    const { client } = testApp({ editions: testEditions(['uk']).read() });

    await expect(
      client.content.latest({ editionId: 'pl', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      defined: true,
    });
  });
});

/** The backend serving Editions of the ids, none of them with a remote switch yet. */
function servingEditions(...ids: string[]) {
  return testApp({ editions: testEditions(ids).read() });
}

describe('edition.switches', () => {
  it('answers no Rules and no force-update minimums while the owner set none', async () => {
    const { client } = servingEditions('untouched');

    const switches = await client.edition.switches({ params: { editionId: 'untouched' } });

    expect(switches).toMatchObject({ status: 200, body: { rules: [], minimums: {} } });
  });

  it('answers the Kill switch as one Rule off for everyone, and none once cleared', async () => {
    const { client, kill, clearRules } = servingEditions('emergency');
    const params = { editionId: 'emergency' };

    await kill('emergency', 'game');
    const off = await client.edition.switches({ params });
    await clearRules('emergency', 'game');
    const cleared = await client.edition.switches({ params });

    expect(off).toMatchObject({
      status: 200,
      body: { rules: [{ id: 'kill', feature: 'game', verdict: 'off', targets: {} }] },
    });
    expect(cleared).toMatchObject({ status: 200, body: { rules: [] } });
  });

  it('still lists a feature off for everyone in `off`, for the apps that read only that', async () => {
    const { client, kill, clearRules } = servingEditions('older-app');
    const params = { editionId: 'older-app' };

    await kill('older-app', 'game');
    const off = await client.edition.switches({ params });
    await clearRules('older-app', 'game');
    const cleared = await client.edition.switches({ params });

    expect(off.status === 200 && off.body.off).toContain('game');
    expect(cleared.status === 200 && cleared.body.off).toEqual([]);
  });

  it("keeps each Edition's switches apart", async () => {
    const { client, kill } = servingEditions('switched', 'neighbour');
    await kill('switched', 'game');

    const neighbour = await client.edition.switches({ params: { editionId: 'neighbour' } });

    expect(neighbour).toMatchObject({ body: { rules: [] } });
  });

  it('answers 304 without the switches when If-None-Match names their ETag', async () => {
    const { client } = servingEditions('cached');
    const params = { editionId: 'cached' };
    const first = await client.edition.switches({ params });
    const { etag } = first.headers;

    const same = await client.edition.switches({ params, headers: { 'if-none-match': etag } });
    const listed = await client.edition.switches({
      params,
      headers: { 'if-none-match': `"other", W/${etag}` },
    });

    expect(etag).toMatch(/^".+"$/);
    expect(same).toMatchObject({ status: 304, headers: { etag } });
    expect(same).not.toHaveProperty('body', expect.anything());
    expect(listed.status).toBe(304);
  });

  it('answers the switches with a new ETag once they change', async () => {
    const { client, kill, clearRules } = servingEditions('changed');
    const params = { editionId: 'changed' };
    const before = (await client.edition.switches({ params })).headers.etag;
    await kill('changed', 'corrections');

    const after = await client.edition.switches({ params, headers: { 'if-none-match': before } });
    await clearRules('changed', 'corrections');
    const back = await client.edition.switches({ params });

    expect(after).toMatchObject({
      status: 200,
      body: { rules: [{ feature: 'corrections', verdict: 'off', targets: {} }] },
    });
    expect(after.headers.etag).not.toBe(before);
    expect(back.headers.etag).toBe(before);
  });

  it('answers NOT_FOUND for an Edition the backend did not find', async () => {
    const { client } = servingEditions('uk');

    await expect(client.edition.switches({ params: { editionId: 'pl' } })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      defined: true,
    });
  });

  it('refuses a request with an unknown query field as BAD_REQUEST', async () => {
    const { client } = servingEditions('uk');
    // The contract's types allow no query field, so the test slips one past them.
    const query = { feature: 'game' } as unknown as Record<string, never>;

    await expect(
      client.edition.switches({ params: { editionId: 'uk' }, query }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });
});

describe('a feature turned off remotely', () => {
  it('makes content.latest NOT_FOUND, until the owner clears it', async () => {
    const { client, kill, clearRules } = servingEditions('remote-off');
    await kill('remote-off', 'contentUpdates');

    await expect(
      client.content.latest({ editionId: 'remote-off', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    await clearRules('remote-off', 'contentUpdates');
    await expect(
      client.content.latest({ editionId: 'remote-off', packFormat: PACK_FORMAT }),
    ).resolves.toEqual({ pack: null });
  });

  it('makes a Sign-in code request NOT_FOUND, and nothing is sent', async () => {
    const { client, mailer, kill } = servingEditions('no-account');
    await kill('no-account', 'account');

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'no-account' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(mailer.sent).toEqual([]);
  });

  it("leaves the Edition's other features served", async () => {
    const { client, kill } = servingEditions('partly-off');
    await kill('partly-off', 'game');

    await expect(
      client.content.latest({ editionId: 'partly-off', packFormat: PACK_FORMAT }),
    ).resolves.toEqual({ pack: null });
  });

  it('can not turn on a feature the Edition turns off', async () => {
    const folder = testEditions(['edition-off'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, contentUpdates: 'off' },
    }));
    const { client, clearRules } = testApp({ editions: folder.read() });

    await expect(clearRules('edition-off', 'contentUpdates')).resolves.toMatchObject({
      ok: true,
      rules: [],
    });

    await expect(
      client.content.latest({ editionId: 'edition-off', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
