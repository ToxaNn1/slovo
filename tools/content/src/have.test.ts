import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';

const toolDir = fileURLToPath(new URL('../', import.meta.url));
const ukrainian = openEdition(EDITIONS_DIR, 'uk');

let workDir: string;
let editionDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-have-'));
  editionDir = join(workDir, 'editions', 'uk');
  cpSync(ukrainian.dir, editionDir, {
    recursive: true,
    filter: (source) => !relative(ukrainian.dir, source).startsWith('dist'),
  });
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Runs `pnpm content` over the copy. */
function content(args: string[]) {
  const run = spawnSync(
    join(toolDir, 'node_modules/.bin/tsx'),
    ['--disable-warning=ExperimentalWarning', join(toolDir, 'src/cli.ts'), ...args],
    { encoding: 'utf8', env: { ...process.env, SLOVO_EDITIONS_DIR: join(workDir, 'editions') } },
  );
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

function readJson(file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(join(editionDir, file), 'utf8'));
  if (typeof value !== 'object' || value === null) throw new Error(`${file} is not an object`);
  return Object.fromEntries(Object.entries(value));
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(join(editionDir, file), `${JSON.stringify(value, null, 2)}\n`);
}

function lines(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line !== '');
}

describe('have', () => {
  it('prints one line per Entry of the copy: kind, Category or type, text', () => {
    const copy = openEdition(join(workDir, 'editions'), 'uk');
    const { idioms } = copy.entries();
    const idiom = idioms[0]?.entry;
    if (idiom === undefined) throw new Error('the UA Edition has no Idioms');
    writeJson(copy.entryFile(idiom.id), { ...idiom, expression: 'як грім серед ясної ночі' });

    const { status, stdout } = content(['have', '--edition', 'uk']);

    expect(status).toBe(0);
    const printed = lines(stdout);
    expect(printed).toHaveLength(copy.entryTexts().length);
    expect(printed).toContain(`idiom\t${idiom.idiomType}\tяк грім серед ясної ночі`);
    const kinds = new Set(printed.map((line) => line.split('\t')[0]));
    expect(kinds).toEqual(new Set(['word', 'correction', 'idiom', 'synonym-row', 'tip']));
  });

  it('prints only the kind --kind names', () => {
    const copy = openEdition(join(workDir, 'editions'), 'uk');

    const { status, stdout } = content(['have', '--edition', 'uk', '--kind', 'idiom']);

    expect(status).toBe(0);
    const printed = lines(stdout);
    expect(printed).toHaveLength(copy.entries().idioms.length);
    expect(printed.every((line) => line.startsWith('idiom\t'))).toBe(true);
  });

  it('marks a Retired Entry', () => {
    const copy = openEdition(join(workDir, 'editions'), 'uk');
    const word = copy.entries().words.find(({ entry }) => !entry.retired)?.entry;
    if (word === undefined) throw new Error('the UA Edition has no Words');
    const file = copy.entryFile(word.id);
    writeJson(file, { ...readJson(file), retired: true });

    const { stdout } = content(['have', '--edition', 'uk', '--kind', 'word']);

    expect(lines(stdout)).toContain(`word\t${word.categoryId}\t${word.lemma}\tretired`);
  });

  it('refuses a kind it does not know', () => {
    const { status, stderr } = content(['have', '--edition', 'uk', '--kind', 'poem']);

    expect(status).toBe(2);
    expect(stderr).toContain('Usage');
  });
});

describe('counts', () => {
  it('prints Words per Category and rarity with totals, and the gap under a target', () => {
    const copy = openEdition(join(workDir, 'editions'), 'uk');
    const live = copy.entries().words.filter(({ entry }) => !entry.retired);
    const [category] = copy.config.categories;
    if (category === undefined) throw new Error('the UA Edition has no Categories');
    const inCategory = live.filter(({ entry }) => entry.categoryId === category.id);
    const byRarity = [1, 2, 3, 4, 5].map(
      (rarity) => inCategory.filter(({ entry }) => entry.rarity === rarity).length,
    );
    const target = inCategory.length + 7;
    const targets = readJson('content/targets.json');
    writeJson('content/targets.json', {
      ...targets,
      minWords: live.length + 1,
      minWordsByCategory: { [category.id]: target },
    });

    const { status, stdout } = content(['counts', '--edition', 'uk']);

    expect(status).toBe(0);
    const rows = lines(stdout).map((line) => line.trim().split(/\s{2,}/));
    expect(rows).toContainEqual([
      category.id,
      ...byRarity.map(String),
      `${String(inCategory.length)} (-7)`,
    ]);
    expect(rows.find((row) => row[0] === 'Words')).toEqual([
      'Words',
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
      'total',
    ]);
    expect(rows.find((row) => row[0] === 'total')?.at(-1)).toBe(`${String(live.length)} (-1)`);
  });

  it('prints Corrections per Category, with the gap under the per-Category target', () => {
    const copy = openEdition(join(workDir, 'editions'), 'uk');
    const live = copy.entries().corrections.filter(({ entry }) => !entry.retired);
    const [category] = copy.config.correctionCategories;
    if (category === undefined) throw new Error('the UA Edition has no Categories of Corrections');
    const count = live.filter(({ entry }) => entry.categoryId === category.id).length;
    writeJson('content/targets.json', {
      ...readJson('content/targets.json'),
      minCorrectionsPerCategory: count + 2,
    });

    const { stdout } = content(['counts', '--edition', 'uk']);

    const rows = lines(stdout).map((line) => line.trim().split(/\s{2,}/));
    expect(rows).toContainEqual(['Corrections', 'total']);
    expect(rows).toContainEqual([category.id, `${String(count)} (-2)`]);
  });
});
