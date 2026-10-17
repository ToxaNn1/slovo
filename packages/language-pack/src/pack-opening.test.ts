import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { buildLanguagePack, openLanguagePack } from './index';
import { openPack, type AppEditions } from './pack-reader';
import { nodePackDatabase } from './read-pack';

// Opening a compiled pack the way the mobile shell does, over the Node driver.

const fixtureDir = fileURLToPath(new URL('../fixtures/valid', import.meta.url));

const workDirs: string[] = [];
const openDatabases: DatabaseSync[] = [];

afterEach(() => {
  for (const db of openDatabases.splice(0)) db.close();
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Builds the fixture Edition, whose id is `fixture`, into a fresh pack file. */
function builtPack(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-pack-opening-'));
  workDirs.push(dir);
  const outFile = join(dir, 'language-pack.db');
  if (!buildLanguagePack({ editionDir: fixtureDir, outFile }).ok)
    throw new Error('No fixture pack');
  return outFile;
}

function open(file: string, editions: AppEditions) {
  const db = new DatabaseSync(file, { readOnly: true });
  openDatabases.push(db);
  return openPack(nodePackDatabase(db), editions);
}

/** Changes the pack's metadata table in place, as a broken or foreign pack would have it. */
function editMetadata(file: string, sql: string): void {
  const db = new DatabaseSync(file);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}

const recordedChecksum = (
  JSON.parse(readFileSync(join(fixtureDir, 'content/manifest.json'), 'utf8')) as {
    contentChecksum: string;
  }
).contentChecksum;

describe('openPack', () => {
  it('opens a pack of the app’s Edition, and its reader reads the pack', async () => {
    const opening = await open(builtPack(), { bundle: 'fixture', native: 'fixture' });

    if (!opening.ok) throw new Error(opening.reason);
    const metadata = {
      editionId: 'fixture',
      contentVersion: 3,
      contentChecksum: recordedChecksum,
      packFormat: 1,
    };
    expect(opening.metadata).toEqual(metadata);
    expect(await opening.reader.metadata()).toEqual(metadata);
    expect(await opening.reader.listWordIds()).toEqual(['w_fx0002', 'w_fx0003']);
  });

  it('opens it when the native app does not report its Edition', async () => {
    const opening = await open(builtPack(), { bundle: 'fixture', native: undefined });

    expect(opening.ok).toBe(true);
  });

  it('refuses a pack of another Edition, naming the Edition of each part', async () => {
    const opening = await open(builtPack(), { bundle: 'pl', native: 'pl' });

    expect(opening).toEqual({
      ok: false,
      reason:
        'The app mixes Editions (native app: "pl", JavaScript bundle: "pl", Language Pack: "fixture"). Rebuild the Language Pack and the native app for one Edition.',
    });
  });

  it('refuses a pack of another Edition when the native app does not report one', async () => {
    const opening = await open(builtPack(), { bundle: 'pl', native: undefined });

    expect(opening).toMatchObject({
      ok: false,
      reason: expect.stringContaining(
        'native app: not reported, JavaScript bundle: "pl", Language Pack: "fixture"',
      ) as string,
    });
  });

  it('refuses a native app of another Edition than the bundle and the pack', async () => {
    const opening = await open(builtPack(), { bundle: 'fixture', native: 'pl' });

    expect(opening).toMatchObject({
      ok: false,
      reason: expect.stringContaining('native app: "pl"') as string,
    });
  });

  it.each(['edition_id', 'content_version', 'checksum', 'pack_format'])(
    'fails on a pack whose metadata has no %s',
    async (key) => {
      const file = builtPack();
      editMetadata(file, `DELETE FROM metadata WHERE key = '${key}'`);

      await expect(open(file, { bundle: 'fixture', native: undefined })).rejects.toThrow();
      const pack = openLanguagePack(file);
      try {
        await expect(pack.metadata()).rejects.toThrow();
      } finally {
        pack.close();
      }
    },
  );

  it.each([
    ['content_version', 'three'],
    ['content_version', '0'],
    ['pack_format', 'one'],
    ['pack_format', '0'],
    ['checksum', 'sha256:abc'],
    ['edition_id', ''],
  ])('fails on a pack whose metadata has %s "%s"', async (key, value) => {
    const file = builtPack();
    editMetadata(file, `UPDATE metadata SET value = '${value}' WHERE key = '${key}'`);

    await expect(open(file, { bundle: 'fixture', native: undefined })).rejects.toThrow();
  });
});
