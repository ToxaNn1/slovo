import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createContent, systemRandom } from '@slovo/core';

import { buildLanguagePack } from './index';
import { createPackReader, type PackDatabase } from './pack-reader';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** Opens a freshly built fixture pack behind the asynchronous driver interface the reader expects. */
function openFixturePack(name: string): PackDatabase {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-reader-'));
  const outFile = join(dir, 'language-pack.db');
  buildLanguagePack({ editionDir: fixture(name), outFile });
  const db = new DatabaseSync(outFile, { readOnly: true });
  cleanups.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    getAllAsync: <T>(sql: string, params: readonly SQLInputValue[]) =>
      Promise.resolve(db.prepare(sql).all(...params) as T[]),
    getFirstAsync: <T>(sql: string, params: readonly SQLInputValue[]) =>
      Promise.resolve((db.prepare(sql).get(...params) as T | undefined) ?? null),
  };
}

describe('createPackReader', () => {
  it('lets the Core read Words from a pack through any SQLite driver', async () => {
    const content = createContent({
      port: createPackReader(openFixturePack('valid')),
      random: systemRandom,
    });

    expect((await content.firstWord())?.id).toBe('w_fx0001');
    expect(await content.wordById('w_fx0002')).toEqual({
      id: 'w_fx0002',
      lemma: 'балакучий',
      stress: [5],
      partOfSpeech: 'adjective',
      primaryDefinition: 'Який любить багато говорити.',
      categoryId: 'speech',
    });
    expect(await content.wordById('w_missing')).toBeUndefined();
  });
});
