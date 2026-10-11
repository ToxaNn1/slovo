import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createContent, systemRandom } from '@slovo/core';

import { buildLanguagePack, formatBuildError, openLanguagePack } from './index';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const workDirs: string[] = [];

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-pack-'));
  workDirs.push(dir);
  return dir;
}

const packPath = () => join(workDir(), 'language-pack.db');

async function readBack(outFile: string) {
  const pack = openLanguagePack(outFile);
  try {
    return { metadata: pack.metadata(), ids: await pack.listWordIds() };
  } finally {
    pack.close();
  }
}

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('buildLanguagePack', () => {
  it('compiles a valid Edition so the Core returns its Words', async () => {
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile });

    expect(result.ok).toBe(true);
    const pack = openLanguagePack(outFile);
    try {
      const content = createContent({ port: pack, random: systemRandom });
      expect(await content.wordById('w_fx0002')).toEqual({
        id: 'w_fx0002',
        lemma: 'балакучий',
        stress: [5],
        partOfSpeech: 'adjective',
        primaryDefinition: 'Який любить багато говорити.',
        categoryId: 'speech',
      });
      expect((await content.firstWord())?.id).toBe('w_fx0001');
    } finally {
      pack.close();
    }
  });

  it('fails on an invalid Word with an error naming the Entry id and field', () => {
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir: fixture('invalid-word'), outFile });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({ entryId: 'w_fx0002', field: 'partOfSpeech' }),
    ]);
    expect(result.errors.map(formatBuildError)).toEqual([
      expect.stringMatching(/w_fx0002.*partOfSpeech/),
    ]);
    expect(existsSync(outFile)).toBe(false);
  });

  it('yields the same ids, checksum and file when the same content is built twice', async () => {
    const first = packPath();
    const second = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile: first });
    buildLanguagePack({ editionDir: fixture('valid'), outFile: second });

    const a = await readBack(first);
    const b = await readBack(second);
    expect(a.ids).toEqual(['w_fx0001', 'w_fx0002']);
    expect(b.ids).toEqual(a.ids);
    expect(a.metadata).toEqual({
      editionId: 'fixture',
      contentVersion: 3,
      checksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
    });
    expect(b.metadata).toEqual(a.metadata);
    expect(readFileSync(second).equals(readFileSync(first))).toBe(true);
  });

  it('changes the checksum when the content changes', async () => {
    const editionDir = join(workDir(), 'edition');
    cpSync(fixture('valid'), editionDir, { recursive: true });
    const wordFile = join(editionDir, 'content/words/w_fx0001.json');
    const word = JSON.parse(readFileSync(wordFile, 'utf8')) as Record<string, unknown>;
    writeFileSync(wordFile, JSON.stringify({ ...word, primaryDefinition: 'Інше значення.' }));
    const original = packPath();
    const edited = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile: original });
    buildLanguagePack({ editionDir, outFile: edited });

    const a = await readBack(original);
    const b = await readBack(edited);
    expect(b.metadata.checksum).not.toBe(a.metadata.checksum);
  });
});
