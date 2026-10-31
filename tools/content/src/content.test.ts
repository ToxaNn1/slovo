import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
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

  it("refuses a literary use not yet in the public domain with the build's message, and records nothing", () => {
    const before = { registry: registry(), manifest: manifest() };
    // An author who died this year stays protected for 70 more years, whatever today is.
    const authorDeathYear = new Date().getFullYear();
    const literaryUse = {
      text: 'Це тестоформа.',
      author: 'Тестовий автор',
      work: 'Тестовий твір',
      authorDeathYear,
    };

    const run = content(['new', 'correction', '--edition', 'uk'], {
      edits: [{ ...validCorrection, literaryUses: [literaryUse] }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = file.slice('content/corrections/'.length, -'.json'.length);
    expect(run.stderr).toContain(
      `${file} › Entry ${id} › literaryUses.0.authorDeathYear: Not in the public domain until 1 January ${String(authorDeathYear + 71)}`,
    );
    expect(run.stdout).not.toContain(`Recorded ${file}`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
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

/** The Ukrainian Edition's Entries, to pick the ones the tests open. */
const authored = ukrainian.entries();
const unstressed = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\u0301/g, '')
    .normalize('NFC');
/** The first of the Entries whose text no other Entry of the list shares. */
function single<E extends { id: string }>(
  authoredEntries: readonly { entry: E }[],
  text: (entry: E) => string,
): E {
  const entries = authoredEntries.map(({ entry }) => entry);
  const found = entries.find(
    (one) => entries.filter((other) => text(other) === text(one)).length === 1,
  );
  if (found === undefined) throw new Error('No Entry with a text of its own');
  return found;
}
const word = single(authored.words, (entry) => entry.lemma);
const idiom = single(authored.idioms, (entry) => entry.expression);
const stressedCorrection = single(
  authored.corrections.filter(
    ({ entry }) => entry.nonStandardForm !== unstressed(entry.nonStandardForm),
  ),
  (entry) => unstressed(entry.nonStandardForm),
);
const homonyms = authored.words
  .filter(
    ({ entry }) => authored.words.filter((other) => other.entry.lemma === entry.lemma).length > 1,
  )
  .map(({ entry }) => entry);
const homonymLemma = homonyms[0]?.lemma ?? '';
const homonymIds = homonyms
  .filter(({ lemma }) => lemma === homonymLemma)
  .map(({ id }) => id)
  .toSorted();

describe('pnpm content edit', () => {
  it.each([
    ['its id', word.id, word.id, { primaryDefinition: 'Нове значення.' }],
    ['its Lemma', word.lemma, word.id, { primaryDefinition: 'Нове значення.' }],
    ['its expression', idiom.expression, idiom.id, { primaryDefinition: 'Нове значення.' }],
    [
      'its non-standard form, typed without the stress mark',
      unstressed(stressedCorrection.nonStandardForm),
      stressedCorrection.id,
      { explanation: 'Нове пояснення.' },
    ],
  ])('opens an Entry found by %s and records it once it passes', (_text, text, id, edit) => {
    const file = ukrainian.entryFile(id);
    const before = { registry: registry(), version: manifest().contentVersion };

    const run = content(['edit', text, '--edition', 'uk'], {
      edits: [edit],
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.opened).toEqual([file]);
    expect(readJson(file)).toMatchObject({ id, ...edit });
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(registry()).toEqual(before.registry);
    expect(manifest().contentVersion).toBe(before.version + 1);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it('lists the Entries a text matches and opens the one the owner picks', () => {
    expect(homonymIds.length).toBeGreaterThan(1);
    const [, second = ''] = homonymIds;
    const file = ukrainian.entryFile(second);

    const run = content(['edit', homonymLemma, '--edition', 'uk'], {
      edits: [{ primaryDefinition: 'Нове значення.' }],
      answers: '2\n',
    });

    expect(run.status).toBe(0);
    homonymIds.forEach((id, index) => {
      expect(run.stdout).toMatch(
        new RegExp(`${String(index + 1)}\\. ${id} word ${homonymLemma}: \\S`),
      );
    });
    expect(run.stdout).toContain(`Open which? [1-${String(homonymIds.length)}]`);
    expect(run.opened).toEqual([file]);
    expect(run.stdout).toContain(`Recorded ${file}`);
  });

  it('opens nothing when the owner picks none of the matches', () => {
    const run = content(['edit', homonymLemma, '--edition', 'uk'], { answers: '\n' });

    expect(run.status).toBe(1);
    expect(run.opened).toEqual([]);
    expect(run.stderr).toContain('No Entry picked: nothing opened');
  });

  it('opens nothing for a text no Entry matches', () => {
    const run = content(['edit', 'немаєтакогослова', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.opened).toEqual([]);
    expect(run.stderr).toContain('No Entry of Edition "uk" matches "немаєтакогослова"');
  });

  it('prints each problem of a broken save and keeps the file unrecorded when not reopened', () => {
    const file = ukrainian.entryFile(word.id);
    const before = manifest();

    const run = content(['edit', word.id, '--edition', 'uk'], {
      edits: [{ rarity: 9 }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`${file} › Entry ${word.id} › rarity:`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(readJson(file)).toMatchObject({ rarity: 9 });
    expect(manifest()).toEqual(before);
  });

  it('writes nothing for an Entry closed unchanged', () => {
    const file = ukrainian.entryFile(idiom.id);
    const before = { text: readFileSync(join(editionDir, file), 'utf8'), manifest: manifest() };

    const run = content(['edit', idiom.id, '--edition', 'uk'], { edits: [null] });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`${file} closed unchanged: nothing written`);
    expect(readFileSync(join(editionDir, file), 'utf8')).toBe(before.text);
    expect(manifest()).toEqual(before.manifest);
  });
});

describe('pnpm content retire', () => {
  it.each([
    ['Word', word.id],
    ['Correction', stressedCorrection.id],
    ['Idiom', idiom.id],
  ])('retires a %s, keeps its file and records the content', (_kind, id) => {
    const file = ukrainian.entryFile(id);
    const entry = readJson(file) as Record<string, unknown>;
    const before = { registry: registry(), version: manifest().contentVersion };

    const run = content(['retire', id, '--edition', 'uk']);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.opened).toEqual([]);
    expect(readJson(file)).toEqual({ ...entry, retired: true });
    expect(run.stdout).toContain(`Retired ${file}`);
    expect(registry()).toEqual(before.registry);
    expect(manifest().contentVersion).toBe(before.version + 1);
    // Retiring may miss a content target, but the build has nothing to refuse.
    expect(content(['check', '--edition', 'uk']).stdout).toContain('Edition "uk": no problems');
  });

  it('writes nothing for an Entry already retired', () => {
    const retired = authored.words.find(({ entry }) => entry.retired)?.entry.id ?? '';
    const file = ukrainian.entryFile(retired);
    const before = { text: readFileSync(join(editionDir, file), 'utf8'), manifest: manifest() };

    const run = content(['retire', retired, '--edition', 'uk']);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`${file} is already retired: nothing written`);
    expect(readFileSync(join(editionDir, file), 'utf8')).toBe(before.text);
    expect(manifest()).toEqual(before.manifest);
  });

  it('refuses an id no Entry has, and a missing id', () => {
    const unknown = content(['retire', 'w_000000', '--edition', 'uk']);
    const missing = content(['retire', '--edition', 'uk']);

    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('No Entry of Edition "uk" has the id "w_000000"');
    expect(missing.status).toBe(2);
    expect(missing.stderr).toMatch(/Usage: pnpm content/);
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

describe('a Synonym Row', () => {
  const folder = 'content/synonym-rows';
  /** A row whose first member links a Word of the Edition. */
  const validRow = {
    dominant: { text: 'тестоговорити', stress: [10] },
    meaning: 'Тестове значення: висловлювати думки словами.',
    members: [
      { text: word.lemma, stress: word.stress, wordId: word.id, shadeNote: 'тестовий відтінок' },
      { text: 'тестомовити', stress: [6] },
      { text: 'тестоказати', stress: [8] },
      { text: 'тестобалакати', stress: [8] },
      { text: 'тестогомоніти', stress: [10] },
    ],
    sources: [{ title: 'Тестове джерело' }],
  };
  const idOf = (file = '') => file.slice(folder.length + 1, -'.json'.length);
  /** Drafts and records a valid row, and returns its file and id. */
  function recordedRow() {
    const run = content(['new', 'synonym-row', '--edition', 'uk'], { edits: [validRow] });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const [file = ''] = run.opened;
    return { file, id: idOf(file) };
  }

  it('is drafted with a fresh r_ id and every field it requires, and recorded once it passes', () => {
    const before = { registry: registry(), version: manifest().contentVersion };

    const run = content(['new', 'synonym-row', '--edition', 'uk'], {
      edits: [{ meaning: 'Тестове значення.' }, validRow],
      answers: 'y\n',
    });

    expect(run.status).toBe(0);
    const [file = '', reopened, ...others] = run.opened;
    const id = idOf(file);
    expect(file).toBe(`${folder}/${id}.json`);
    expect(id).toMatch(/^r_[a-z0-9]{6}$/);
    expect(reopened).toBe(file);
    expect(others).toEqual([]);
    expect(before.registry).not.toContain(id);
    expect(run.stderr).toContain(`${file} › Entry ${id} › dominant.text:`);
    expect(readJson(file)).toEqual({
      kind: 'synonymRow',
      id,
      ...validRow,
    });
    expect(registry()).toEqual([...before.registry, id]);
    expect(manifest().contentVersion).toBe(before.version + 1);
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it('writes a draft that names every field a row requires', () => {
    const run = content(['new', 'synonym-row', '--edition', 'uk'], {
      edits: [{ meaning: 'Тестове значення.' }],
      answers: 'n\n',
    });
    const [file = ''] = run.opened;

    const member = { text: '', stress: [] };
    expect(readJson(file)).toEqual({
      kind: 'synonymRow',
      id: idOf(file),
      dominant: { text: '', stress: [] },
      meaning: 'Тестове значення.',
      members: [member, member, member, member, member],
      sources: [{ title: '' }],
    });
  });

  it("prints each problem of a bad row with the build's reasons and records nothing", () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'synonym-row', '--edition', 'uk'], {
      edits: [
        {
          ...validRow,
          dominant: { text: 'тестоговорити', stress: [0], wordId: 'w_000000' },
          members: [...validRow.members, { text: 'ТестоМовити', stress: [6] }],
        },
      ],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = idOf(file);
    const problem = (field: string) => `${file} › Entry ${id} › ${field}:`;
    expect(run.stderr).toContain(`${problem('dominant.stress.0')} Position 0 is "т", not a vowel`);
    expect(run.stderr).toContain(`${problem('dominant.wordId')} Unknown Word "w_000000"`);
    expect(run.stderr).toContain(`${problem('members.5.text')} Same text as members.1:`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);
  });

  it.each([
    ['its id', (id: string) => id],
    ['its dominant, typed in another case', () => 'ТестоГоворити'],
  ])('is opened by %s and recorded once it passes', (_by, text) => {
    const { file, id } = recordedRow();
    const version = manifest().contentVersion;

    const run = content(['edit', text(id), '--edition', 'uk'], {
      edits: [{ meaning: 'Нове значення.' }],
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.opened).toEqual([file]);
    expect(readJson(file)).toMatchObject({ id, meaning: 'Нове значення.' });
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(manifest().contentVersion).toBe(version + 1);
  });

  it('is listed among the Entries its dominant matches', () => {
    const { id } = recordedRow();
    const twin = recordedRow();

    const run = content(['edit', 'тестоговорити', '--edition', 'uk'], { answers: '\n' });

    const [first, second] = [id, twin.id].toSorted();
    expect(run.stdout).toContain(
      `1. ${String(first)} synonym-row тестоговорити: Тестове значення: висловлювати думки словами.`,
    );
    expect(run.stdout).toContain(`2. ${String(second)} synonym-row тестоговорити:`);
  });

  it('keeps an edit that breaks it unrecorded and prints why', () => {
    const { file, id } = recordedRow();
    const before = manifest();

    const run = content(['edit', id, '--edition', 'uk'], {
      edits: [{ members: validRow.members.slice(0, 4) }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`${file} › Entry ${id} › members:`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(manifest()).toEqual(before);
  });

  it('is retired, keeps its file and the content is recorded', () => {
    const { file, id } = recordedRow();
    const row = readJson(file) as Record<string, unknown>;
    const version = manifest().contentVersion;

    const run = content(['retire', id, '--edition', 'uk']);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(readJson(file)).toEqual({ ...row, retired: true });
    expect(run.stdout).toContain(`Retired ${file}`);
    expect(manifest().contentVersion).toBe(version + 1);
    expect(content(['check', '--edition', 'uk']).stdout).toContain('Edition "uk": no problems');
  });

  it('is checked with the rest of the Edition, each problem in its file and field', () => {
    const { file, id } = recordedRow();
    const row = readJson(file) as typeof validRow;
    writeFileSync(
      join(editionDir, file),
      JSON.stringify({ ...row, members: [...row.members, { text: 'тестомовити', stress: [6] }] }),
    );

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Edition "uk": 1 problem(s)');
    expect(run.stderr).toContain(`${file} › Entry ${id} › members.5.text: `);
  });
});

describe('a Tip', () => {
  const folder = 'content/tips';
  const validTip = {
    title: 'Тестопорада?',
    nonStandardForm: 'Тестонеправильно',
    standardForm: 'Тестоправильно',
    explanation: 'Тестове пояснення: так кажуть українською.',
    sources: [{ title: 'Тестове джерело' }],
    gameQuestion: {
      prompt: 'Як сказати правильно?',
      rightAnswer: 'Тестоправильно',
      wrongAnswers: ['Тестонеправильно', 'Тестохибно', 'Тестокриво'],
    },
  };
  const idOf = (file = '') => file.slice(folder.length + 1, -'.json'.length);
  /** Drafts and records a valid Tip, and returns its file and id. */
  function recordedTip() {
    const run = content(['new', 'tip', '--edition', 'uk'], { edits: [validTip] });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const [file = ''] = run.opened;
    return { file, id: idOf(file) };
  }

  it('is drafted with a fresh t_ id and every field it requires, and recorded once it passes', () => {
    const before = { registry: registry(), version: manifest().contentVersion };

    const run = content(['new', 'tip', '--edition', 'uk'], {
      edits: [{ title: 'Тестопорада?' }, validTip],
      answers: 'y\n',
    });

    expect(run.status).toBe(0);
    const [file = '', reopened, ...others] = run.opened;
    const id = idOf(file);
    expect(file).toBe(`${folder}/${id}.json`);
    expect(id).toMatch(/^t_[a-z0-9]{6}$/);
    expect(reopened).toBe(file);
    expect(others).toEqual([]);
    expect(before.registry).not.toContain(id);
    expect(run.stderr).toContain(`${file} › Entry ${id} › standardForm:`);
    expect(readJson(file)).toEqual({ kind: 'tip', id, ...validTip });
    expect(registry()).toEqual([...before.registry, id]);
    expect(manifest().contentVersion).toBe(before.version + 1);
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it('writes a draft that names every field a Tip requires, its Game question included', () => {
    const run = content(['new', 'tip', '--edition', 'uk'], {
      edits: [{ title: 'Тестопорада?' }],
      answers: 'n\n',
    });
    const [file = ''] = run.opened;

    expect(readJson(file)).toEqual({
      kind: 'tip',
      id: idOf(file),
      title: 'Тестопорада?',
      standardForm: '',
      explanation: '',
      sources: [{ title: '' }],
      gameQuestion: { prompt: '', rightAnswer: '', wrongAnswers: ['', '', ''] },
    });
  });

  it("prints each problem of a bad Tip with the build's reasons and records nothing", () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'tip', '--edition', 'uk'], {
      edits: [
        {
          ...validTip,
          explanation: 'т'.repeat(301),
          sources: [],
        },
      ],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = idOf(file);
    const problem = (field: string) => `${file} › Entry ${id} › ${field}:`;
    expect(run.stderr).toContain(problem('explanation'));
    expect(run.stderr).toContain(problem('sources'));
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);

    const answers = content(['new', 'tip', '--edition', 'uk'], {
      edits: [
        {
          ...validTip,
          gameQuestion: {
            ...validTip.gameQuestion,
            wrongAnswers: ['ТестоПравильно', 'Тестохибно', 'Тестокриво'],
          },
        },
      ],
      answers: 'n\n',
    });
    const [other = ''] = answers.opened;
    expect(answers.stderr).toContain(
      `${other} › Entry ${idOf(other)} › gameQuestion.wrongAnswers.0: Same answer as rightAnswer`,
    );
  });

  it('refuses a Game question without three wrong answers', () => {
    const run = content(['new', 'tip', '--edition', 'uk'], {
      edits: [
        {
          ...validTip,
          gameQuestion: { ...validTip.gameQuestion, wrongAnswers: ['Тестохибно', 'Тестокриво'] },
        },
      ],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    expect(run.stderr).toContain(`${file} › Entry ${idOf(file)} › gameQuestion.wrongAnswers`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
  });

  it.each([
    ['its id', (id: string) => id],
    ['its title, typed in another case', () => 'тестоПОРАДА?'],
  ])('is opened by %s and recorded once it passes', (_by, text) => {
    const { file, id } = recordedTip();
    const version = manifest().contentVersion;

    const run = content(['edit', text(id), '--edition', 'uk'], {
      edits: [{ explanation: 'Нове пояснення.' }],
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.opened).toEqual([file]);
    expect(readJson(file)).toMatchObject({ id, explanation: 'Нове пояснення.' });
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(manifest().contentVersion).toBe(version + 1);
  });

  it('is listed among the Entries its title matches', () => {
    const { id } = recordedTip();
    const twin = recordedTip();

    const run = content(['edit', 'Тестопорада?', '--edition', 'uk'], { answers: '\n' });

    const [first, second] = [id, twin.id].toSorted();
    expect(run.stdout).toContain(`1. ${String(first)} tip Тестопорада?: Тестоправильно`);
    expect(run.stdout).toContain(`2. ${String(second)} tip Тестопорада?:`);
  });

  it('keeps an edit that breaks it unrecorded and prints why', () => {
    const { file, id } = recordedTip();
    const before = manifest();

    const run = content(['edit', id, '--edition', 'uk'], {
      edits: [{ sources: [] }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`${file} › Entry ${id} › sources:`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(manifest()).toEqual(before);
  });

  it('is retired, keeps its file and the content is recorded', () => {
    const { file, id } = recordedTip();
    const tip = readJson(file) as Record<string, unknown>;
    const version = manifest().contentVersion;

    const run = content(['retire', id, '--edition', 'uk']);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(readJson(file)).toEqual({ ...tip, retired: true });
    expect(run.stdout).toContain(`Retired ${file}`);
    expect(manifest().contentVersion).toBe(version + 1);
    expect(content(['check', '--edition', 'uk']).stdout).toContain('Edition "uk": no problems');
  });

  it('is checked with the rest of the Edition, each problem in its file and field', () => {
    const { file, id } = recordedTip();
    const tip = readJson(file) as typeof validTip;
    writeFileSync(
      join(editionDir, file),
      JSON.stringify({
        ...tip,
        gameQuestion: {
          ...tip.gameQuestion,
          wrongAnswers: ['тестохибно', 'Тестохибно', 'Тестокриво'],
        },
      }),
    );

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Edition "uk": 1 problem(s)');
    expect(run.stderr).toContain(
      `${file} › Entry ${id} › gameQuestion.wrongAnswers.1: Same answer as wrongAnswers.0`,
    );
  });
});

describe("a Word's origin", () => {
  const originCodes = ukrainian.config.originLanguages.map(({ code, name }) => `${code} (${name})`);
  const origin = ukrainian.config.originLanguages[0]?.code ?? '';

  it("is offered from the Edition's codes when a Word is drafted, and recorded once it passes", () => {
    const run = content(['new', 'word', '--edition', 'uk'], { edits: [{ ...validWord, origin }] });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`origin: one of ${originCodes.join(', ')}, or none`);
    const [file = ''] = run.opened;
    expect(readJson(file)).toMatchObject({ origin });
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it("is offered from the Edition's codes when a Word is edited, and recorded once it passes", () => {
    const file = ukrainian.entryFile(word.id);

    const run = content(['edit', word.id, '--edition', 'uk'], { edits: [{ origin }] });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`origin: one of ${originCodes.join(', ')}, or none`);
    expect(readJson(file)).toMatchObject({ id: word.id, origin });
    expect(run.stdout).toContain(`Recorded ${file}`);
  });

  it('is left out of the draft, so a Word recorded without one carries none', () => {
    const run = content(['new', 'word', '--edition', 'uk'], { edits: [validWord] });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const drafted = JSON.parse(readFileSync(join(workDir, 'edits.json.last'), 'utf8')) as unknown;
    expect(drafted).toMatchObject({ kind: 'word', lemma: '' });
    expect(drafted).not.toHaveProperty('origin');
    const [file = ''] = run.opened;
    expect(readJson(file)).not.toHaveProperty('origin');
    expect(run.stdout).toContain(`Recorded ${file}`);
  });

  it('is not offered for an Entry of another kind', () => {
    const run = content(['edit', idiom.id, '--edition', 'uk'], { edits: [null] });

    expect(run.stdout).not.toContain('origin:');
  });

  it('refuses a code the Edition does not list, and records nothing', () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ ...validWord, origin: 'xx' }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = file.slice('content/words/'.length, -'.json'.length);
    expect(run.stderr).toContain(`${file} › Entry ${id} › origin: Unknown origin language "xx"`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);
  });

  it('is checked with the rest of the Edition, an unknown code reported in its file and field', () => {
    const file = ukrainian.entryFile(word.id);
    const entry = readJson(file) as Record<string, unknown>;
    writeFileSync(join(editionDir, file), JSON.stringify({ ...entry, origin: 'xx' }));

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Edition "uk": 1 problem(s)');
    expect(run.stderr).toContain(
      `${file} › Entry ${word.id} › origin: Unknown origin language "xx"`,
    );
  });
});

describe("a Word's moods", () => {
  const moodIds = ukrainian.config.moods.map(({ id, name }) => `${id} (${name})`);
  const [first = '', second = ''] = ukrainian.config.moods.map(({ id }) => id);
  const offer = `moods: any of ${moodIds.join(', ')}, or none`;

  it("are offered from the Edition's list when a Word is drafted, and recorded once they pass", () => {
    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ ...validWord, moods: [first, second] }],
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(offer);
    const [file = ''] = run.opened;
    expect(readJson(file)).toMatchObject({ moods: [first, second] });
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it("are offered from the Edition's list when a Word is edited, and recorded once they pass", () => {
    const file = ukrainian.entryFile(word.id);

    const run = content(['edit', word.id, '--edition', 'uk'], { edits: [{ moods: [first] }] });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(offer);
    expect(readJson(file)).toMatchObject({ id: word.id, moods: [first] });
    expect(run.stdout).toContain(`Recorded ${file}`);
  });

  it('leave the Word without the field once the last mood is removed', () => {
    const file = ukrainian.entryFile(word.id);
    expect(
      content(['edit', word.id, '--edition', 'uk'], { edits: [{ moods: [first] }] }).status,
    ).toBe(0);

    const run = content(['edit', word.id, '--edition', 'uk'], { edits: [{ moods: [] }] });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(readJson(file)).not.toHaveProperty('moods');
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it('are not offered for an Entry of another kind', () => {
    const run = content(['edit', idiom.id, '--edition', 'uk'], { edits: [null] });

    expect(run.stdout).not.toContain('moods:');
  });

  it('refuse an id the Edition does not list, and record nothing', () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ ...validWord, moods: ['grumpy'] }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = file.slice('content/words/'.length, -'.json'.length);
    expect(run.stderr).toContain(`${file} › Entry ${id} › moods: Unknown mood "grumpy"`);
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);
  });

  it('are checked with the rest of the Edition, an unknown id reported in its file and field', () => {
    const file = ukrainian.entryFile(word.id);
    const entry = readJson(file) as Record<string, unknown>;
    writeFileSync(join(editionDir, file), JSON.stringify({ ...entry, moods: ['grumpy'] }));

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Edition "uk": 1 problem(s)');
    expect(run.stderr).toContain(`${file} › Entry ${word.id} › moods: Unknown mood "grumpy"`);
  });

  it('are not offered when the Edition lists none', () => {
    const config = readJson('edition.json') as { featureSwitches: Record<string, unknown> };
    const switches = config.featureSwitches;
    writeFileSync(
      join(editionDir, 'edition.json'),
      JSON.stringify({ ...config, featureSwitches: { ...switches, moods: false }, moods: [] }),
    );

    const run = content(['edit', word.id, '--edition', 'uk'], { edits: [null] });

    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('origin:');
    expect(run.stdout).not.toContain('moods:');
  });
});

describe("a Word's Illustration", () => {
  const offer = 'illustration: a square PNG of at most 150 KB in assets/illustrations/';

  /** The files the copy offers: the Edition's own Illustrations and the ones a test adds. */
  function offered(...added: string[]): string {
    const own = readdirSync(join(ukrainian.dir, 'assets/illustrations'));
    return [...own, ...added].toSorted().join(', ');
  }

  /** The header of a 4×4 PNG: all the build reads of an Illustration. */
  function addPng(name: string): void {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(4, 0);
    header.writeUInt32BE(4, 4);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 13]),
      Buffer.from('IHDR', 'latin1'),
      header,
    ]);
    mkdirSync(join(editionDir, 'assets/illustrations'), { recursive: true });
    writeFileSync(join(editionDir, 'assets/illustrations', name), png);
  }

  it('is offered with the files the Edition has when a Word is drafted, and recorded once it passes', () => {
    addPng('kupyna.png');
    addPng('bervy.png');

    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ ...validWord, illustration: 'kupyna.png' }],
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`${offer} (${offered('bervy.png', 'kupyna.png')}), or none`);
    const [file = ''] = run.opened;
    expect(readJson(file)).toMatchObject({ illustration: 'kupyna.png' });
    expect(run.stdout).toContain(`Recorded ${file}`);
    expect(content(['check', '--edition', 'uk']).status).toBe(0);
  });

  it('is offered with the PNGs alone, not the other files of the folder', () => {
    addPng('kupyna.png');
    writeFileSync(join(editionDir, 'assets/illustrations', '.DS_Store'), '');

    const run = content(['new', 'word', '--edition', 'uk'], { edits: [validWord] });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(offer);
    expect(run.stdout).not.toContain('.DS_Store');
  });

  it('is in the draft, and a Word saved with it empty leaves the field out', () => {
    const run = content(['new', 'word', '--edition', 'uk'], { edits: [validWord] });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const drafted = JSON.parse(readFileSync(join(workDir, 'edits.json.last'), 'utf8')) as unknown;
    expect(drafted).toMatchObject({ illustration: '' });
    const [file = ''] = run.opened;
    expect(readJson(file)).not.toHaveProperty('illustration');
    expect(run.stdout).toContain(`Recorded ${file}`);
  });

  it('is offered when a Word is edited, and recorded once it passes', () => {
    addPng('kupyna.png');
    const file = ukrainian.entryFile(word.id);

    const run = content(['edit', word.id, '--edition', 'uk'], {
      edits: [{ illustration: 'kupyna.png' }],
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`${offer} (${offered('kupyna.png')}), or none`);
    expect(readJson(file)).toMatchObject({ id: word.id, illustration: 'kupyna.png' });
    expect(run.stdout).toContain(`Recorded ${file}`);
  });

  it('is offered without files when the Edition has none', () => {
    rmSync(join(editionDir, 'assets/illustrations'), { recursive: true });

    const run = content(['edit', word.id, '--edition', 'uk'], { edits: [null] });

    expect(run.stdout).toContain(`${offer}, or none`);
  });

  it('is not offered for an Entry of another kind', () => {
    const run = content(['edit', idiom.id, '--edition', 'uk'], { edits: [null] });

    expect(run.stdout).not.toContain('illustration:');
  });

  it('refuses a file the Edition does not have, and records nothing', () => {
    const before = { registry: registry(), manifest: manifest() };

    const run = content(['new', 'word', '--edition', 'uk'], {
      edits: [{ ...validWord, illustration: 'missing.png' }],
      answers: 'n\n',
    });

    expect(run.status).toBe(1);
    const [file = ''] = run.opened;
    const id = file.slice('content/words/'.length, -'.json'.length);
    expect(run.stderr).toContain(
      `${file} › Entry ${id} › illustration: No file missing.png in assets/illustrations/`,
    );
    expect(run.stderr).toContain(`Kept ${file}, not recorded`);
    expect(registry()).toEqual(before.registry);
    expect(manifest()).toEqual(before.manifest);
  });

  it('is checked with the rest of the Edition, a missing file reported in its file and field', () => {
    const file = ukrainian.entryFile(word.id);
    const entry = readJson(file) as Record<string, unknown>;
    writeFileSync(
      join(editionDir, file),
      JSON.stringify({ ...entry, illustration: 'missing.png' }),
    );

    const run = content(['check', '--edition', 'uk']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Edition "uk": 1 problem(s)');
    expect(run.stderr).toContain(
      `${file} › Entry ${word.id} › illustration: No file missing.png in assets/illustrations/`,
    );
  });
});
