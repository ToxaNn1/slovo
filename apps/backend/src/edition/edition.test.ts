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
  it('answers no feature off while the owner turned none off', async () => {
    const { client } = servingEditions('untouched');

    const switches = await client.edition.switches({ params: { editionId: 'untouched' } });

    expect(switches).toMatchObject({ status: 200, body: { off: [] } });
  });

  it('answers a feature after the owner turns it off, and none after they clear it', async () => {
    const { client, switchOff, clearSwitch } = servingEditions('emergency');
    const params = { editionId: 'emergency' };

    await expect(switchOff('emergency', 'game')).resolves.toEqual({ ok: true, off: ['game'] });
    const off = await client.edition.switches({ params });
    await expect(clearSwitch('emergency', 'game')).resolves.toEqual({ ok: true, off: [] });
    const cleared = await client.edition.switches({ params });

    expect(off).toMatchObject({ status: 200, body: { off: ['game'] } });
    expect(cleared).toMatchObject({ status: 200, body: { off: [] } });
  });

  it('answers every feature turned off, in name order', async () => {
    const { client, switchOff } = servingEditions('several');
    await switchOff('several', 'game');
    await switchOff('several', 'contentUpdates');
    await switchOff('several', 'account');

    const switches = await client.edition.switches({ params: { editionId: 'several' } });

    expect(switches).toMatchObject({ body: { off: ['account', 'contentUpdates', 'game'] } });
  });

  it.each([
    'notifications',
    'widget',
    'shareCards',
    'pronunciation',
    'wordOfTheDay',
    'statistics',
    'knowledge',
    'selfCheck',
    'rarityFloor',
    'gameReview',
  ])('turns the %s switch off remotely and back on', async (feature) => {
    const { client, switchOff, clearSwitch } = servingEditions('polish');
    const params = { editionId: 'polish' };

    await expect(switchOff('polish', feature)).resolves.toEqual({ ok: true, off: [feature] });
    const off = await client.edition.switches({ params });
    await expect(clearSwitch('polish', feature)).resolves.toEqual({ ok: true, off: [] });
    const cleared = await client.edition.switches({ params });

    expect(off).toMatchObject({ status: 200, body: { off: [feature] } });
    expect(cleared).toMatchObject({ status: 200, body: { off: [] } });
  });

  it("keeps each Edition's switches apart", async () => {
    const { client, switchOff } = servingEditions('switched', 'neighbour');
    await switchOff('switched', 'game');

    const neighbour = await client.edition.switches({ params: { editionId: 'neighbour' } });

    expect(neighbour).toMatchObject({ body: { off: [] } });
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
    const { client, switchOff, clearSwitch } = servingEditions('changed');
    const params = { editionId: 'changed' };
    const before = (await client.edition.switches({ params })).headers.etag;
    await switchOff('changed', 'corrections');

    const after = await client.edition.switches({ params, headers: { 'if-none-match': before } });
    await clearSwitch('changed', 'corrections');
    const back = await client.edition.switches({ params });

    expect(after).toMatchObject({ status: 200, body: { off: ['corrections'] } });
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
  it('makes content.latest and content.download NOT_FOUND, until the owner clears it', async () => {
    const folder = testEditions(['remote-off']);
    const pack = folder.buildPack('remote-off');
    const { client, publish, switchOff, clearSwitch } = testApp({ editions: folder.read() });
    await publish(pack);
    const params = { editionId: 'remote-off', contentVersion: pack.announced.contentVersion };
    await switchOff('remote-off', 'contentUpdates');

    await expect(
      client.content.latest({ editionId: 'remote-off', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(client.content.download({ params })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });

    await clearSwitch('remote-off', 'contentUpdates');
    await expect(
      client.content.latest({ editionId: 'remote-off', packFormat: PACK_FORMAT }),
    ).resolves.toEqual({ pack: pack.announced });
  });

  it('makes a Sign-in code request NOT_FOUND, and nothing is sent', async () => {
    const { client, mailer, switchOff } = servingEditions('no-account');
    await switchOff('no-account', 'account');

    await expect(
      client.account.requestCode({ email: newEmail(), editionId: 'no-account' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(mailer.sent).toEqual([]);
  });

  it("leaves the Edition's other features served", async () => {
    const { client, switchOff } = servingEditions('partly-off');
    await switchOff('partly-off', 'game');

    await expect(
      client.content.latest({ editionId: 'partly-off', packFormat: PACK_FORMAT }),
    ).resolves.toEqual({ pack: null });
  });

  it('can not turn on a feature the Edition turns off', async () => {
    const folder = testEditions(['edition-off'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, contentUpdates: false },
    }));
    const { client, clearSwitch } = testApp({ editions: folder.read() });

    await expect(clearSwitch('edition-off', 'contentUpdates')).resolves.toEqual({
      ok: true,
      off: [],
    });

    await expect(
      client.content.latest({ editionId: 'edition-off', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('the switch commands', () => {
  it('refuse an Edition the backend did not find, and switch nothing', async () => {
    const { client, switchOff, clearSwitch } = servingEditions('found');

    await expect(switchOff('pl', 'game')).resolves.toEqual({
      ok: false,
      reason: 'unknown-edition',
    });
    await expect(clearSwitch('pl', 'game')).resolves.toEqual({
      ok: false,
      reason: 'unknown-edition',
    });
    await expect(
      client.edition.switches({ params: { editionId: 'found' } }),
    ).resolves.toMatchObject({ body: { off: [] } });
  });

  it('refuse a feature the Feature Switches schema does not know, and switch nothing', async () => {
    const { client, switchOff, clearSwitch } = servingEditions('typo');

    await expect(switchOff('typo', 'gmae')).resolves.toEqual({
      ok: false,
      reason: 'unknown-feature',
    });
    await expect(clearSwitch('typo', 'gmae')).resolves.toEqual({
      ok: false,
      reason: 'unknown-feature',
    });
    await expect(client.edition.switches({ params: { editionId: 'typo' } })).resolves.toMatchObject(
      {
        body: { off: [] },
      },
    );
  });

  it('turn a feature off once however often they run, and clear one that is on', async () => {
    const { switchOff, clearSwitch } = servingEditions('repeated');

    await expect(clearSwitch('repeated', 'game')).resolves.toEqual({ ok: true, off: [] });
    await switchOff('repeated', 'game');
    await expect(switchOff('repeated', 'game')).resolves.toEqual({ ok: true, off: ['game'] });
  });
});
