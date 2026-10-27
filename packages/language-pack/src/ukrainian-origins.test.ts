import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Word } from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainian, ukrainianFolder } from './test-support';

// The origins of the real Ukrainian Language Pack: the Words «Звідки слово»
// asks about (spec #772, seam 1; ADR 0052).

let workDir: string;
let pack: NodeLanguagePack;
let words: readonly Word[];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-origins-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  words = await pack.listWords();
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('the origins of the Ukrainian Language Pack', () => {
  it('gives at least 60 Words an origin, each a language the Edition lists', () => {
    const origins = words.flatMap(({ origin }) => (origin === undefined ? [] : [origin]));
    const listed = ukrainian.originLanguages.map(({ code }) => code);

    expect(origins.length).toBeGreaterThanOrEqual(60);
    expect(origins.filter((origin) => !listed.includes(origin))).toEqual([]);
  });
});
