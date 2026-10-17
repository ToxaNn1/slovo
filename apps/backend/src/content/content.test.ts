import type { Edition } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { sha256, testApp, testEditions } from '../test-support';

describe('content.latest', () => {
  it('answers none for the Ukrainian Edition while no pack is published', async () => {
    const { client } = testApp();

    const latest = await client.content.latest({ editionId: 'uk', packFormat: 1 });

    expect(latest).toEqual({ pack: null });
  });

  it('refuses a request with an unknown field as BAD_REQUEST', async () => {
    const { client } = testApp();
    // The contract's types allow no unknown field, so the test slips one past them.
    const input = { editionId: 'uk', packFormat: 1, since: 3 };

    await expect(client.content.latest(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
      defined: true,
    });
  });

  it('refuses a pack format that is not a positive whole number as BAD_REQUEST', async () => {
    const { client } = testApp();

    await expect(client.content.latest({ editionId: 'uk', packFormat: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });
});

/** The SHA-256 of a downloaded file. */
async function sha256Of(file: Blob): Promise<string> {
  return sha256(new Uint8Array(await file.arrayBuffer()));
}

describe('publishing a Language Pack', () => {
  it('makes it the latest of its pack format, and another format still answers none', async () => {
    const folder = testEditions(['published']);
    const pack = folder.buildPack('published');
    const { client, publish } = testApp({ editions: folder.read() });

    await expect(publish(pack)).resolves.toEqual({ ok: true, pack: pack.announced });

    await expect(client.content.latest({ editionId: 'published', packFormat: 1 })).resolves.toEqual(
      { pack: pack.announced },
    );
    await expect(client.content.latest({ editionId: 'published', packFormat: 2 })).resolves.toEqual(
      { pack: null },
    );
  });

  it('makes a pack of a higher content version the latest', async () => {
    const folder = testEditions(['grown']);
    const first = folder.buildPack('grown');
    const { client, publish } = testApp({ editions: folder.read() });
    await publish(first);
    folder.correctWord('grown');
    const second = folder.buildPack('grown');

    await expect(publish(second, folder.read())).resolves.toMatchObject({ ok: true });

    expect(second.announced.contentVersion).toBeGreaterThan(first.announced.contentVersion);
    await expect(client.content.latest({ editionId: 'grown', packFormat: 1 })).resolves.toEqual({
      pack: second.announced,
    });
  });

  it('refuses a pack whose content checksum the Edition does not record, and keeps nothing', async () => {
    const folder = testEditions(['unrecorded']);
    const stale = folder.buildPack('unrecorded');
    folder.correctWord('unrecorded');
    const { client, publish } = testApp({ editions: folder.read() });

    await expect(publish(stale)).resolves.toEqual({ ok: false, reason: 'not-recorded' });

    await expect(
      client.content.latest({ editionId: 'unrecorded', packFormat: 1 }),
    ).resolves.toEqual({ pack: null });
  });

  it('refuses a pack of another Edition as one the Edition does not record', async () => {
    const folder = testEditions(['mine', 'theirs']);
    const pack = folder.buildPack('theirs');
    const { client, publish } = testApp({ editions: folder.read() });

    await expect(publish({ ...pack, editionId: 'mine' })).resolves.toEqual({
      ok: false,
      reason: 'not-recorded',
    });

    for (const editionId of ['mine', 'theirs']) {
      await expect(client.content.latest({ editionId, packFormat: 1 })).resolves.toEqual({
        pack: null,
      });
    }
  });

  it('refuses a content version not higher than the latest published one, and keeps nothing', async () => {
    const folder = testEditions(['shrunk']);
    const older = folder.buildPack('shrunk');
    const olderEditions = folder.read();
    folder.correctWord('shrunk');
    const newer = folder.buildPack('shrunk');
    const { client, publish } = testApp({ editions: folder.read() });
    await publish(newer);

    await expect(publish(older, olderEditions)).resolves.toEqual({
      ok: false,
      reason: 'version-not-higher',
    });

    await expect(client.content.latest({ editionId: 'shrunk', packFormat: 1 })).resolves.toEqual({
      pack: newer.announced,
    });
    // Had it been kept, its version would be published now.
    await expect(publish(older, olderEditions)).resolves.toEqual({
      ok: false,
      reason: 'version-not-higher',
    });
  });

  it('refuses a content version already published, and keeps nothing', async () => {
    const folder = testEditions(['twice']);
    const pack = folder.buildPack('twice');
    const { client, publish } = testApp({ editions: folder.read() });
    await publish(pack);

    await expect(publish(pack)).resolves.toEqual({ ok: false, reason: 'already-published' });

    await expect(client.content.latest({ editionId: 'twice', packFormat: 1 })).resolves.toEqual({
      pack: pack.announced,
    });
  });

  it('refuses a pack of an Edition the backend did not find', async () => {
    const folder = testEditions(['unknown']);
    const pack = folder.buildPack('unknown');
    const { publish } = testApp({ editions: folder.read() });

    await expect(publish(pack, [])).resolves.toEqual({ ok: false, reason: 'unknown-edition' });
  });
});

/** The Editions with the `contentUpdates` Feature Switch off. */
function withContentUpdatesOff(editions: readonly Edition[]): Edition[] {
  return editions.map((edition) => ({
    ...edition,
    config: {
      ...edition.config,
      featureSwitches: { ...edition.config.featureSwitches, contentUpdates: false },
    },
  }));
}

/** An Edition with one published pack, and the backend serving it. */
async function publishedPack(editionId: string) {
  const folder = testEditions([editionId]);
  const pack = folder.buildPack(editionId);
  const backend = testApp({ editions: folder.read() });
  await backend.publish(pack);
  return { ...backend, pack };
}

describe('content.download', () => {
  it('answers the bytes of a published pack, whose SHA-256 content.latest announces', async () => {
    const { client, pack } = await publishedPack('downloaded');

    const download = await client.content.download({
      params: { editionId: 'downloaded', contentVersion: pack.announced.contentVersion },
    });

    expect(download.status).toBe(200);
    if (download.status !== 200) return;
    expect(download.body.size).toBe(pack.announced.size);
    expect(await sha256Of(download.body)).toBe(pack.announced.fileSha256);
  });

  it('lets a client keep the file for good, named by its SHA-256 as the ETag', async () => {
    const { client, pack } = await publishedPack('kept');

    const download = await client.content.download({
      params: { editionId: 'kept', contentVersion: pack.announced.contentVersion },
    });

    expect(download.headers.etag).toBe(`"${pack.announced.fileSha256}"`);
    expect(download.headers['cache-control']).toMatch(/\bimmutable\b/);
  });

  it('answers 304 without the bytes when If-None-Match names the ETag', async () => {
    const { client, pack } = await publishedPack('unchanged');
    const etag = `"${pack.announced.fileSha256}"`;
    const params = { editionId: 'unchanged', contentVersion: pack.announced.contentVersion };

    const same = await client.content.download({ params, headers: { 'if-none-match': etag } });
    const listed = await client.content.download({
      params,
      headers: { 'if-none-match': `"${'0'.repeat(64)}", W/${etag}` },
    });
    const other = await client.content.download({
      params,
      headers: { 'if-none-match': `"${'0'.repeat(64)}"` },
    });

    expect(same).toMatchObject({ status: 304, headers: { etag } });
    expect(same).not.toHaveProperty('body', expect.anything());
    expect(listed.status).toBe(304);
    expect(other.status).toBe(200);
  });

  it('answers a second download without reading the database again', async () => {
    const { client, pack, close } = await publishedPack('released');
    const params = { editionId: 'released', contentVersion: pack.announced.contentVersion };
    await client.content.download({ params });

    await close();
    const again = await client.content.download({ params });

    expect(again.status).toBe(200);
    if (again.status !== 200) return;
    expect(await sha256Of(again.body)).toBe(pack.announced.fileSha256);
  });

  it('answers NOT_FOUND for a content version not published', async () => {
    const { client, pack } = await publishedPack('one-version');

    await expect(
      client.content.download({
        params: { editionId: 'one-version', contentVersion: pack.announced.contentVersion + 1 },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('answers NOT_FOUND for an Edition the backend did not find', async () => {
    const { client } = testApp();

    await expect(
      client.content.download({ params: { editionId: 'xx', contentVersion: 1 } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('refuses a request with an unknown query field as BAD_REQUEST', async () => {
    const { client } = testApp();
    // The contract's types allow no query field, so the test slips one past them.
    const query = { packFormat: 1 } as unknown as Record<string, never>;
    const input = { params: { editionId: 'uk', contentVersion: 1 }, query };

    await expect(client.content.download(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('refuses a content version that is not a positive whole number as BAD_REQUEST', async () => {
    const { client } = testApp();

    for (const contentVersion of [0, 1.5, 2 ** 31]) {
      await expect(
        client.content.download({ params: { editionId: 'uk', contentVersion } }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    }
  });
});

describe('an Edition with content updates switched off', () => {
  it('answers NOT_FOUND to content.latest and content.download, with a pack published', async () => {
    const folder = testEditions(['switched-off']);
    const pack = folder.buildPack('switched-off');
    const { publish } = testApp({ editions: folder.read() });
    await publish(pack);

    const { client } = testApp({ editions: withContentUpdatesOff(folder.read()) });

    await expect(
      client.content.latest({ editionId: 'switched-off', packFormat: 1 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(
      client.content.download({
        params: { editionId: 'switched-off', contentVersion: pack.announced.contentVersion },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
