import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildLanguagePack, recordContent } from '@slovo/language-pack';
import { EDITIONS_DIR, editionFiles, openEdition } from '@slovo/language-pack/edition';
import type { Clock, Edition } from '@slovo/server-core';
import { describe, expect, it, onTestFinished } from 'vitest';

import { readEditions } from '../edition/edition-folders';
import { testApp } from '../test-support';
import { publishPack } from './publish-pack';

describe('content.latest', () => {
  it('answers none for the Ukrainian Edition while no pack is published', async () => {
    const { client, close } = testApp();
    onTestFinished(close);

    const latest = await client.content.latest({ editionId: 'uk', packFormat: 1 });

    expect(latest).toEqual({ pack: null });
  });

  it('refuses a request with an unknown field as BAD_REQUEST', async () => {
    const { client, close } = testApp();
    onTestFinished(close);
    // The contract's types allow no unknown field, so the test slips one past them.
    const input = { editionId: 'uk', packFormat: 1, since: 3 };

    await expect(client.content.latest(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
      defined: true,
    });
  });

  it('refuses a pack format that is not a positive whole number as BAD_REQUEST', async () => {
    const { client, close } = testApp();
    onTestFinished(close);

    await expect(client.content.latest({ editionId: 'uk', packFormat: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });
});

/** The SHA-256 of a file's bytes, as 64 lowercase hex digits. */
function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The SHA-256 of a downloaded file. */
async function sha256Of(file: Blob): Promise<string> {
  return sha256(new Uint8Array(await file.arrayBuffer()));
}

/**
 * An Edition of a test's own, in a new editions folder: the Ukrainian
 * Edition's config, strings and content under the id, its content recorded.
 * The test run shares one database, so each test that publishes takes an id
 * of its own.
 */
function testEdition(editionId: string) {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-content-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const ukrainian = openEdition(EDITIONS_DIR, 'uk');
  const edition = editionFiles(join(dir, editionId));
  cpSync(join(ukrainian.dir, 'content'), join(edition.dir, 'content'), { recursive: true });
  copyFileSync(ukrainian.path('strings'), edition.path('strings'));
  const config = JSON.parse(readFileSync(ukrainian.path('config'), 'utf8')) as object;
  writeFileSync(edition.path('config'), JSON.stringify({ ...config, id: editionId }));
  const record = () => {
    if (!recordContent({ editionDir: edition.dir }).ok) throw new Error('Content not recorded');
  };
  record();

  let builds = 0;
  return {
    /** The Edition as the backend reads it now. */
    editions: (): Edition[] => readEditions(dir),
    /** Builds the pack of the content as it is now, and what `content.latest` announces for it. */
    buildPack() {
      builds += 1;
      const file = join(dir, `language-pack-${String(builds)}.db`);
      const built = buildLanguagePack({ editionDir: edition.dir, outFile: file });
      if (!built.ok) throw new Error('Pack not built');
      const bytes = readFileSync(file);
      return {
        editionId,
        file,
        announced: {
          contentVersion: built.metadata.contentVersion,
          packFormat: 1,
          size: bytes.byteLength,
          fileSha256: sha256(bytes),
        },
      };
    },
    /** Corrects a Word's Definition and records the content, which raises its version. */
    correctWord() {
      const wordsDir = join(edition.dir, 'content/words');
      const name = readdirSync(wordsDir).find((file) => file.endsWith('.json'));
      if (name === undefined) throw new Error('No Word to correct');
      const file = join(wordsDir, name);
      const word = JSON.parse(readFileSync(file, 'utf8')) as { primaryDefinition: string };
      const primaryDefinition = `${word.primaryDefinition} (corrected)`;
      writeFileSync(file, JSON.stringify({ ...word, primaryDefinition }));
      record();
    },
  };
}

/** The time publishing reads. */
const clock: Clock = { now: () => new Date('2026-10-17T09:00:00Z') };

/** The backend serving the Editions, and its publish command on the same database. */
function testBackend(editions: readonly Edition[]) {
  const { client, database, close } = testApp({ editions });
  onTestFinished(close);
  return {
    client,
    /** Closes the backend's database, as when Postgres goes away. */
    closeDatabase: close,
    /**
     * Publishes the pack file of the Edition as the Editions read when the
     * command runs: those the backend serves unless given.
     */
    publish: (
      { editionId, file }: { editionId: string; file: string },
      editionsNow: readonly Edition[] = editions,
    ) => publishPack({ database, clock, editions: editionsNow, editionId, file }),
  };
}

describe('publishing a Language Pack', () => {
  it('makes it the latest of its pack format, and another format still answers none', async () => {
    const edition = testEdition('published');
    const pack = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());

    await expect(publish(pack)).resolves.toEqual({ ok: true, pack: pack.announced });

    await expect(client.content.latest({ editionId: 'published', packFormat: 1 })).resolves.toEqual(
      { pack: pack.announced },
    );
    await expect(client.content.latest({ editionId: 'published', packFormat: 2 })).resolves.toEqual(
      { pack: null },
    );
  });

  it('makes a pack of a higher content version the latest', async () => {
    const edition = testEdition('grown');
    const first = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());
    await publish(first);
    edition.correctWord();
    const second = edition.buildPack();

    await expect(publish(second, edition.editions())).resolves.toMatchObject({ ok: true });

    expect(second.announced.contentVersion).toBeGreaterThan(first.announced.contentVersion);
    await expect(client.content.latest({ editionId: 'grown', packFormat: 1 })).resolves.toEqual({
      pack: second.announced,
    });
  });

  it('refuses a pack whose content checksum the Edition does not record, and keeps nothing', async () => {
    const edition = testEdition('unrecorded');
    const stale = edition.buildPack();
    edition.correctWord();
    const { client, publish } = testBackend(edition.editions());

    await expect(publish(stale)).resolves.toEqual({ ok: false, reason: 'not-recorded' });

    await expect(
      client.content.latest({ editionId: 'unrecorded', packFormat: 1 }),
    ).resolves.toEqual({ pack: null });
  });

  it('refuses a pack of another Edition as one the Edition does not record', async () => {
    const edition = testEdition('mine');
    const other = testEdition('theirs');
    const pack = other.buildPack();
    const { client, publish } = testBackend([...edition.editions(), ...other.editions()]);

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
    const edition = testEdition('shrunk');
    const older = edition.buildPack();
    const olderEditions = edition.editions();
    edition.correctWord();
    const newer = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());
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
    const edition = testEdition('twice');
    const pack = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());
    await publish(pack);

    await expect(publish(pack)).resolves.toEqual({ ok: false, reason: 'already-published' });

    await expect(client.content.latest({ editionId: 'twice', packFormat: 1 })).resolves.toEqual({
      pack: pack.announced,
    });
  });

  it('refuses a pack of an Edition the backend did not find', async () => {
    const edition = testEdition('unknown');
    const pack = edition.buildPack();
    const { publish } = testBackend(edition.editions());

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
  const edition = testEdition(editionId);
  const pack = edition.buildPack();
  const backend = testBackend(edition.editions());
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
    const { client, pack, closeDatabase } = await publishedPack('released');
    const params = { editionId: 'released', contentVersion: pack.announced.contentVersion };
    await client.content.download({ params });

    await closeDatabase();
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
    const { client, close } = testApp();
    onTestFinished(close);

    await expect(
      client.content.download({ params: { editionId: 'xx', contentVersion: 1 } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('refuses a request with an unknown query field as BAD_REQUEST', async () => {
    const { client, close } = testApp();
    onTestFinished(close);
    // The contract's types allow no query field, so the test slips one past them.
    const query = { packFormat: 1 } as unknown as Record<string, never>;
    const input = { params: { editionId: 'uk', contentVersion: 1 }, query };

    await expect(client.content.download(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('refuses a content version that is not a positive whole number as BAD_REQUEST', async () => {
    const { client, close } = testApp();
    onTestFinished(close);

    for (const contentVersion of [0, 1.5, 2 ** 31]) {
      await expect(
        client.content.download({ params: { editionId: 'uk', contentVersion } }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    }
  });
});

describe('an Edition with content updates switched off', () => {
  it('answers NOT_FOUND to content.latest and content.download, with a pack published', async () => {
    const edition = testEdition('switched-off');
    const pack = edition.buildPack();
    const { publish } = testBackend(edition.editions());
    await publish(pack);

    const { client, close } = testApp({ editions: withContentUpdatesOff(edition.editions()) });
    onTestFinished(close);

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
