import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';

const toolDir = fileURLToPath(new URL('../', import.meta.url));
const ukrainian = openEdition(EDITIONS_DIR, 'uk');
const categoryId = ukrainian.config.categories[0]?.id ?? '';
const takenWord = ukrainian.entryTexts().find(({ kind, retired }) => kind === 'word' && !retired);

const word = (lemma: string, primaryDefinition = 'Тестове значення.') => ({
  lemma,
  stress: [1],
  partOfSpeech: 'noun',
  gender: 'neuter',
  primaryDefinition,
  categoryId,
  rarity: 3,
  sources: [{ title: 'Тестове джерело' }],
});

let workDir: string;
let editionDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-import-'));
  editionDir = join(workDir, 'editions', 'uk');
  // The UA Edition as it is, without its built pack.
  cpSync(ukrainian.dir, editionDir, {
    recursive: true,
    filter: (source) => !relative(ukrainian.dir, source).startsWith('dist'),
  });
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Runs `pnpm content import` over the copy. */
function content(args: string[]) {
  const run = spawnSync(
    join(toolDir, 'node_modules/.bin/tsx'),
    ['--disable-warning=ExperimentalWarning', join(toolDir, 'src/cli.ts'), ...args],
    { encoding: 'utf8', env: { ...process.env, SLOVO_EDITIONS_DIR: join(workDir, 'editions') } },
  );
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** Writes the JSON array to import and returns its path. */
function array(items: unknown[]): string {
  const path = join(workDir, 'new.json');
  writeFileSync(path, JSON.stringify(items));
  return path;
}

/** Writes ready drafts, as `source:*` writes them, and returns their folder. */
function drafts(entries: Record<string, unknown>[]): string {
  const dir = join(workDir, 'review', 'words', 'drafts');
  mkdirSync(dir, { recursive: true });
  for (const entry of entries) {
    writeFileSync(join(dir, `${String(entry['id'])}.json`), JSON.stringify(entry, null, 2));
  }
  return dir;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(editionDir, file), 'utf8'));
}

const files = (dir: string) => readdirSync(join(editionDir, 'content', dir)).toSorted();
const registry = () => readJson('content/ids.json') as string[];
const manifest = () => readJson('content/manifest.json') as { contentVersion: number };
const snapshot = () => ({
  words: files('words'),
  corrections: files('corrections'),
  registry: registry(),
  version: manifest().contentVersion,
});

describe('pnpm content import', () => {
  it('writes each Entry of an array with a fresh id in its kind folder and records the content', () => {
    const before = snapshot();

    const run = content([
      'import',
      'word',
      array([word('тестоперше'), word('тестодруге')]),
      '--edition',
      'uk',
    ]);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const added = files('words').filter((file) => !before.words.includes(file));
    expect(added).toHaveLength(2);
    const ids = added.map((file) => file.replace(/\.json$/, ''));
    for (const id of ids) {
      expect(id).toMatch(/^w_[a-z0-9]{6}$/);
      expect(before.registry).not.toContain(id);
      expect(run.stdout).toContain(`content/words/${id}.json`);
    }
    const written = added.map(
      (file) => readJson(`content/words/${file}`) as Record<string, unknown>,
    );
    expect(written.map(({ lemma }) => lemma).toSorted()).toEqual(['тестодруге', 'тестоперше']);
    // The shape `new` drafts: kind and id first, then the fields in its order.
    expect(Object.keys(written[0] ?? {}).slice(0, 4)).toEqual(['kind', 'id', 'lemma', 'stress']);
    expect(new Set(registry())).toEqual(new Set([...before.registry, ...ids]));
    expect(manifest().contentVersion).toBe(before.version + 1);
  });

  it('refuses an Entry whose text the Edition has in any kind, before writing anything', () => {
    const before = snapshot();
    const taken = takenWord?.text ?? '';
    const correction = {
      nonStandardForm: taken,
      correctionType: 'surzhyk',
      standardEquivalents: ['тестоправильно'],
      explanation: 'Тестове пояснення.',
      examplePair: { nonStandard: 'Це тест.', standard: 'Це тест.' },
      sources: [{ title: 'Тестове джерело' }],
    };

    const run = content(['import', 'correction', array([correction]), '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      `"${taken}" is already an Entry of the Edition: ${takenWord?.id ?? ''}`,
    );
    expect(snapshot()).toEqual(before);
  });

  it('refuses a text repeated in the import', () => {
    const before = snapshot();

    const run = content([
      'import',
      'word',
      array([word('тестоповтор'), word('тестоповтор')]),
      '--edition',
      'uk',
    ]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"тестоповтор" is imported twice');
    expect(snapshot()).toEqual(before);
  });

  it('removes every file it wrote and records nothing when an Entry is broken', () => {
    const before = snapshot();

    const run = content([
      'import',
      'word',
      array([word('тестодобре'), word('тестопогано', '')]),
      '--edition',
      'uk',
    ]);

    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(
      /content\/words\/w_[a-z0-9]{6}\.json › Entry w_[a-z0-9]{6} › primaryDefinition: /,
    );
    expect(snapshot()).toEqual(before);
  });

  it('writes and checks but records nothing with --no-record', () => {
    const before = snapshot();

    const run = content([
      'import',
      'word',
      array([word('тестонезапис')]),
      '--edition',
      'uk',
      '--no-record',
    ]);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(files('words')).toHaveLength(before.words.length + 1);
    expect(registry()).toEqual(before.registry);
    expect(manifest().contentVersion).toBe(before.version);
    expect(run.stdout).toContain('not recorded');
  });

  it('checks the Entries with --no-record too', () => {
    const before = snapshot();

    const run = content([
      'import',
      'word',
      array([word('тестопогано', '')]),
      '--edition',
      'uk',
      '--no-record',
    ]);

    expect(run.status).toBe(1);
    expect(snapshot()).toEqual(before);
  });

  it('imports a folder of ready drafts with their ids', () => {
    const before = snapshot();
    const folder = drafts([
      { kind: 'word', id: 'w_dr4ft1', ...word('тесточернетка') },
      { kind: 'word', id: 'w_dr4ft2', ...word('тестоіншачернетка') },
    ]);

    const run = content(['import', 'word', folder, '--edition', 'uk']);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(readJson('content/words/w_dr4ft1.json')).toMatchObject({
      id: 'w_dr4ft1',
      lemma: 'тесточернетка',
    });
    expect(readJson('content/words/w_dr4ft2.json')).toMatchObject({ id: 'w_dr4ft2' });
    expect(new Set(registry())).toEqual(new Set([...before.registry, 'w_dr4ft1', 'w_dr4ft2']));
  });

  it('refuses a draft whose id the Edition already has', () => {
    const takenId = takenWord?.id ?? '';
    const before = snapshot();
    const folder = drafts([{ kind: 'word', ...word('тестозайнятий'), id: takenId }]);

    const run = content(['import', 'word', folder, '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`The id "${takenId}" is already taken in the Edition`);
    expect(snapshot()).toEqual(before);
  });

  it('refuses a draft of another kind', () => {
    const before = snapshot();
    const folder = drafts([{ kind: 'word', id: 'w_dr4ft3', ...word('тестоіншийвид') }]);

    const run = content(['import', 'idiom', folder, '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"w_dr4ft3" is not an id of kind idiom: those start with i_');
    expect(snapshot()).toEqual(before);
  });
});
