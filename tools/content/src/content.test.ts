import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';

const toolDir = fileURLToPath(new URL('../', import.meta.url));
const ukrainian = openEdition(EDITIONS_DIR, 'uk');
const categoryId = ukrainian.config.categories[0]?.id ?? '';

/**
 * The fake editor: on each opening it takes the next edit, records the file
 * it opened, and writes the edit into the file. An edit is a string written
 * as it is, an object merged over the file's JSON (or the last JSON it held,
 * when a string broke it), or null to close the file unchanged.
 */
const FAKE_EDITOR = `
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2];
const { FAKE_EDITS, FAKE_EDITOR_LOG } = process.env;
const edits = JSON.parse(readFileSync(FAKE_EDITS, 'utf8'));
const edit = edits.shift();
writeFileSync(FAKE_EDITS, JSON.stringify(edits));
appendFileSync(FAKE_EDITOR_LOG, file + '\\n');
let json;
try {
  json = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(FAKE_EDITS + '.last', JSON.stringify(json));
} catch {
  json = JSON.parse(readFileSync(FAKE_EDITS + '.last', 'utf8'));
}
if (typeof edit === 'string') writeFileSync(file, edit);
else if (edit !== null && edit !== undefined) writeFileSync(file, JSON.stringify({ ...json, ...edit }));
`;

const validWord = {
  lemma: 'тестослово',
  stress: [1],
  partOfSpeech: 'noun',
  gender: 'neuter',
  primaryDefinition: 'Тестове значення.',
  categoryId,
  rarity: 3,
  sources: [{ title: 'Тестове джерело' }],
};

const validCorrection = {
  nonStandardForm: 'тестоформа',
  correctionType: 'surzhyk',
  standardEquivalents: ['тестоправильно'],
  explanation: 'Тестове пояснення.',
  examplePair: { nonStandard: 'Це тестоформа.', standard: 'Це тестоправильно.' },
  sources: [{ title: 'Тестове джерело' }],
};

const validIdiom = {
  expression: 'тестовий вислів',
  idiomType: 'idiom',
  primaryDefinition: 'Тестове значення.',
  sources: [{ title: 'Тестове джерело' }],
};

// The owner's own editor stays out of the tests.
const { VISUAL: _visual, EDITOR: _editor, ...editorless } = process.env;

let workDir: string;
let editionDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-content-'));
  editionDir = join(workDir, 'editions', 'uk');
  // The Ukrainian Edition as it is, without its built pack.
  cpSync(ukrainian.dir, editionDir, {
    recursive: true,
    filter: (source) => !relative(ukrainian.dir, source).startsWith('dist'),
  });
  writeFileSync(join(workDir, 'fake-editor.mjs'), FAKE_EDITOR);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Runs `pnpm content` over the copy, with the fake editor and the answers typed in the terminal. */
function content(args: string[], { edits = [] as unknown[], answers = '' } = {}) {
  const editsFile = join(workDir, 'edits.json');
  const logFile = join(workDir, 'editor.log');
  writeFileSync(editsFile, JSON.stringify(edits));
  writeFileSync(logFile, '');
  const run = spawnSync(
    join(toolDir, 'node_modules/.bin/tsx'),
    ['--disable-warning=ExperimentalWarning', join(toolDir, 'src/cli.ts'), ...args],
    {
      encoding: 'utf8',
      input: answers,
      env: {
        ...editorless,
        SLOVO_EDITIONS_DIR: join(workDir, 'editions'),
        EDITOR: `"${process.execPath}" "${join(workDir, 'fake-editor.mjs')}"`,
        FAKE_EDITS: editsFile,
        FAKE_EDITOR_LOG: logFile,
      },
    },
  );
  const opened = readFileSync(logFile, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((file) => relative(editionDir, file));
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, opened };
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(editionDir, file), 'utf8'));
}

const registry = () => readJson('content/ids.json') as string[];
const manifest = () => readJson('content/manifest.json') as { contentVersion: number };

describe('pnpm content new', () => {
  it.each([
    ['word', 'content/words', /^w_[a-z0-9]{6}$/, validWord],
    ['correction', 'content/corrections', /^c_[a-z0-9]{6}$/, validCorrection],
    ['idiom', 'content/idioms', /^i_[a-z0-9]{6}$/, validIdiom],
  ])(
    'drafts a %s with a fresh id, and records it once it passes',
    (kind, folder, idPattern, edit) => {
      const before = { registry: registry(), version: manifest().contentVersion };

      const run = content(['new', kind, '--edition', 'uk'], { edits: [edit] });

      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      const [file, ...others] = run.opened;
      expect(others).toEqual([]);
      const id = file?.slice(folder.length + 1, -'.json'.length) ?? '';
      expect(file).toBe(`${folder}/${id}.json`);
      expect(id).toMatch(idPattern);
      expect(before.registry).not.toContain(id);
      expect(readJson(`${folder}/${id}.json`)).toMatchObject({ kind, id, ...edit });
      expect(registry()).toEqual([...before.registry, id]);
      expect(manifest().contentVersion).toBe(before.version + 1);
      expect(run.stdout).toContain(`Recorded ${folder}/${id}.json`);
      expect(content(['check', '--edition', 'uk']).status).toBe(0);
    },
  );

  it('writes a draft that names every field the kind requires', () => {
    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ lemma: 'тестослово' }],
      answers: 'n\n',
    });
    const [file = ''] = run.opened;

    expect(readJson(file)).toEqual({
      kind: 'word',
      id: file.slice('content/words/'.length, -'.json'.length),
      lemma: 'тестослово',
      stress: [],
      partOfSpeech: 'noun',
      gender: 'feminine',
      primaryDefinition: '',
      extraDefinitions: [],
      examples: [],
      synonyms: [],
      antonyms: [],
      registers: [],
      categoryId,
      rarity: 3,
      sources: [{ title: '' }],
      correctionIds: [],
    });
  });

  it('prints each problem of a broken draft and keeps it unrecorded when not reopened', () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ ...validWord, stress: [0], categoryId: 'no-such-category' }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = file.slice('content/words/'.length, -'.json'.length);
    expect(run.stderr).toContain(
      `${file} › Entry ${id} › stress.0: Position 0 is "т", not a vowel`,
    );
    expect(run.stderr).toContain(
      `${file} › Entry ${id} › categoryId: Unknown Category "no-such-category"`,
    );
    expect(run.stdout).toContain(`Reopen ${file} in the editor? [Y/n]`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(existsSync(join(editionDir, file))).toBe(true);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);
  });

  it('reopens a broken draft on request and records it once it is fixed', () => {
    const before = registry();

    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: ['{ "lemma": ', validWord],
      answers: 'y\n',
    });

    expect(run.status).toBe(0);
    const [file = '', reopened] = run.opened;
    expect(reopened).toBe(file);
    expect(run.stderr).toMatch(new RegExp(`${file}: Invalid JSON`));
    const id = file.slice('content/words/'.length, -'.json'.length);
    expect(registry()).toEqual([...before, id]);
  });

  it('writes nothing for a draft closed unchanged', () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'idiom', '--edition', 'uk'], { edits: [null] });

    expect(run.status).toBe(0);
    const [file = ''] = run.opened;
    expect(existsSync(join(editionDir, file))).toBe(false);
    expect(run.stdout).toContain(`${file} closed unchanged: nothing written`);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);
  });

  it('refuses an unknown kind and an unknown Edition', () => {
    const unknownKind = content(['new', 'proverb', '--edition', 'uk']);
    const unknownEdition = content(['new', 'word', '--edition', 'xx']);

    expect(unknownKind.status).toBe(2);
    expect(unknownKind.stderr).toMatch(/Usage: pnpm content/);
    expect(unknownEdition.status).toBe(2);
    expect(unknownEdition.stderr).toMatch(/Unknown Edition "xx"/);
    expect(unknownEdition.opened).toEqual([]);
  });
});

describe('pnpm content check', () => {
  it('passes the Edition as it is', () => {
    const run = content(['check', '--edition', 'uk']);

    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('Edition "uk": no problems');
    expect(run.status).toBe(0);
  });

  it('reports every problem of the Edition, each in its file and field', () => {
    const wordFile = ukrainian.entryFile(registry().find((id) => id.startsWith('w_')) ?? '');
    const correctionFile = ukrainian.entryFile(registry().find((id) => id.startsWith('c_')) ?? '');
    const word = readJson(wordFile) as Record<string, unknown>;
    writeFileSync(join(editionDir, wordFile), JSON.stringify({ ...word, rarity: 9 }));
    writeFileSync(join(editionDir, correctionFile), '{');

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Edition "uk": 2 problem(s)');
    expect(run.stderr).toContain(`${wordFile} › Entry ${String(word['id'])} › rarity:`);
    expect(run.stderr).toContain(`${correctionFile}: Invalid JSON`);
  });

  it('reports content unrecorded since the last edit', () => {
    const file = ukrainian.entryFile(registry().find((id) => id.startsWith('i_')) ?? '');
    const idiom = readJson(file) as Record<string, unknown>;
    writeFileSync(join(editionDir, file), JSON.stringify({ ...idiom, etymology: 'Тестове.' }));

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/content\/manifest\.json.*pnpm build:pack uk --record/);
  });
});
