import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildFromSnapshot } from '@slovo/language-pack';
import { ukrainianFolder, ukrainianSnapshot } from '@slovo/language-pack/test-support';
import { afterAll, describe, expect, it } from 'vitest';

import { testApp } from '../test-support';

const dir = mkdtempSync(join(tmpdir(), 'slovo-snapshot-pack-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
const today = new Date('2026-11-08T12:00:00Z');

describe('the Language Pack built from the snapshot of the local backend', () => {
  it('holds the same content as the pack the Ukrainian suites run over, built from the seed snapshot', async () => {
    const { client, importSnapshot } = testApp();
    await importSnapshot('uk', ukrainianFolder.dir, ukrainianSnapshot());
    const snapshot = await client.content.snapshot({ editionId: 'uk' });

    const fromBackend = buildFromSnapshot({
      editionDir: ukrainianFolder.dir,
      snapshot,
      outFile: join(dir, 'from-backend.db'),
      today,
    });
    const fromSeed = buildFromSnapshot({
      editionDir: ukrainianFolder.dir,
      snapshot: ukrainianSnapshot(),
      outFile: join(dir, 'from-seed.db'),
      today,
    });

    if (!fromBackend.ok || !fromSeed.ok) throw new Error('a pack did not build');
    expect(fromBackend.metadata).toEqual(fromSeed.metadata);
    expect(fromBackend.report).toEqual(fromSeed.report);
  });
});
