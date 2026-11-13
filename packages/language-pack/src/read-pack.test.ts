import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openLanguagePack, packMetadataOf } from './index';
import { buildUkrainianPack } from './test-support';

let dir: string;
let file: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'slovo-read-pack-'));
  file = join(dir, 'language-pack.db');
  if (!buildUkrainianPack(file).ok) throw new Error('No UA pack');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('packMetadataOf', () => {
  it('reads the metadata the built pack records, as its reader does', async () => {
    const pack = openLanguagePack(file);
    const metadata = await pack.metadata();
    pack.close();

    expect(packMetadataOf(file)).toEqual(metadata);
    expect(packMetadataOf(file).editionId).toBe('uk');
  });
});
