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
import { systemClock, type Edition } from '@slovo/server-core';
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
        file,
        announced: {
          contentVersion: built.metadata.contentVersion,
          packFormat: 1,
          size: bytes.byteLength,
          fileSha256: createHash('sha256').update(bytes).digest('hex'),
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
      const primaryDefinition = `${word.primaryDefinition} (виправлено)`;
      writeFileSync(file, JSON.stringify({ ...word, primaryDefinition }));
      record();
    },
  };
}

/** The backend serving the Editions, and its publish command on the same database. */
function testBackend(editions: readonly Edition[]) {
  const { client, database, close } = testApp({ editions });
  onTestFinished(close);
  return {
    client,
    /** Publishes the pack file as the Editions read when it runs: those the backend serves unless given. */
    publish: (file: string, editionsNow: readonly Edition[] = editions) =>
      publishPack({ database, clock: systemClock, editions: editionsNow, file }),
  };
}

describe('publishing a Language Pack', () => {
  it('makes it the latest of its pack format, and another format still answers none', async () => {
    const edition = testEdition('published');
    const pack = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());

    await expect(publish(pack.file)).resolves.toEqual({ ok: true, pack: pack.announced });

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
    await publish(first.file);
    edition.correctWord();
    const second = edition.buildPack();

    await expect(publish(second.file, edition.editions())).resolves.toMatchObject({ ok: true });

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

    await expect(publish(stale.file)).resolves.toEqual({ ok: false, reason: 'not-recorded' });

    await expect(
      client.content.latest({ editionId: 'unrecorded', packFormat: 1 }),
    ).resolves.toEqual({ pack: null });
  });

  it('refuses a content version not higher than the latest published one, and keeps nothing', async () => {
    const edition = testEdition('shrunk');
    const older = edition.buildPack();
    const olderEditions = edition.editions();
    edition.correctWord();
    const newer = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());
    await publish(newer.file);

    await expect(publish(older.file, olderEditions)).resolves.toEqual({
      ok: false,
      reason: 'version-not-higher',
    });

    await expect(client.content.latest({ editionId: 'shrunk', packFormat: 1 })).resolves.toEqual({
      pack: newer.announced,
    });
  });

  it('refuses a content version already published, and keeps nothing', async () => {
    const edition = testEdition('twice');
    const pack = edition.buildPack();
    const { client, publish } = testBackend(edition.editions());
    await publish(pack.file);

    await expect(publish(pack.file)).resolves.toEqual({ ok: false, reason: 'already-published' });

    await expect(client.content.latest({ editionId: 'twice', packFormat: 1 })).resolves.toEqual({
      pack: pack.announced,
    });
  });

  it('refuses a pack of an Edition the backend did not find', async () => {
    const edition = testEdition('unknown');
    const pack = edition.buildPack();
    const { publish } = testBackend(edition.editions());

    await expect(publish(pack.file, [])).resolves.toEqual({
      ok: false,
      reason: 'unknown-edition',
    });
  });
});
