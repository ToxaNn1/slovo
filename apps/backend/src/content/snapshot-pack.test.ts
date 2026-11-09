import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildFromSnapshot, buildLanguagePack } from '@slovo/language-pack';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { afterAll, describe, expect, it } from 'vitest';

import { testApp } from '../test-support';

const dir = mkdtempSync(join(tmpdir(), 'slovo-snapshot-pack-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
const folder = join(dir, 'uk');
cpSync(join(EDITIONS_DIR, 'uk'), folder, { recursive: true });
const today = new Date('2026-11-08T12:00:00Z');

describe('the Language Pack built from the snapshot of the local backend', () => {
  it('holds the same content as the pack the Ukrainian suites run over', async () => {
    const { client, importContent } = testApp();
    await importContent('uk', folder);
    const snapshot = await client.content.snapshot({ editionId: 'uk' });

    const fromSnapshot = buildFromSnapshot({
      editionDir: folder,
      snapshot,
      outFile: join(dir, 'from-snapshot.db'),
      today,
    });
    const fromFolder = buildLanguagePack({
      editionDir: folder,
      outFile: join(dir, 'from-folder.db'),
      today,
    });

    if (!fromSnapshot.ok || !fromFolder.ok) throw new Error('a pack did not build');
    expect(fromSnapshot.metadata).toEqual(fromFolder.metadata);
    expect(fromSnapshot.report).toEqual(fromFolder.report);
  });
});
