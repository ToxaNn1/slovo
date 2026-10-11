import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { CorrectionSchema, WordSchema } from '@slovo/contracts';
import { createContent, type Random } from '@slovo/core';

import {
  buildLanguagePack,
  formatBuildError,
  formatContentReport,
  openLanguagePack,
  recordContent,
  type BuildError,
} from './index';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const workDirs: string[] = [];

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-pack-'));
  workDirs.push(dir);
  return dir;
}

const packPath = () => join(workDir(), 'language-pack.db');

/** A writable copy of a fixture Edition, for tests that need a variation of it. */
function copyFixture(name: string): string {
  const editionDir = join(workDir(), 'edition');
  cpSync(fixture(name), editionDir, { recursive: true });
  return editionDir;
}

type Json = Record<string, unknown>;

function readJsonFile(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function editJson(editionDir: string, file: string, edit: (json: Json) => Json): void {
  const path = join(editionDir, file);
  writeFileSync(path, JSON.stringify(edit(readJsonFile(path))));
}

/** Records edited content, as `pnpm build:pack --record` does, so the copy builds again. */
function record(editionDir: string): void {
  const result = recordContent({ editionDir });
  if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
}

const validWordFiles = ['w_fx0001', 'w_fx0002', 'w_fx0003'].map((id) => `content/words/${id}.json`);

async function readBack(outFile: string) {
  const pack = openLanguagePack(outFile);
  try {
    return { metadata: await pack.metadata(), ids: await pack.listWordIds() };
  } finally {
    pack.close();
  }
}

const fixedRandom = (value: number): Random => ({ next: () => value });

async function withContent<T>(
  outFile: string,
  use: (content: ReturnType<typeof createContent>) => Promise<T>,
  random: Random = fixedRandom(0),
): Promise<T> {
  const pack = openLanguagePack(outFile);
  try {
    return await use(createContent({ port: pack, random }));
  } finally {
    pack.close();
  }
}

function buildErrors(editionDir: string): readonly BuildError[] {
  const outFile = packPath();
  const result = buildLanguagePack({ editionDir, outFile });
  expect(existsSync(outFile)).toBe(false);
  return result.ok ? [] : result.errors;
}

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('buildLanguagePack', () => {
  it('compiles a valid Edition so the Core returns its Words', async () => {
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile });

    expect(result.ok).toBe(true);
    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0002')).toEqual({
        kind: 'word',
        id: 'w_fx0002',
        lemma: 'балакучий',
        stress: [5],
        partOfSpeech: 'adjective',
        primaryDefinition: 'Який любить багато говорити.',
        extraDefinitions: [],
        examples: [],
        synonyms: [],
        antonyms: [],
        registers: [],
        categoryId: 'speech',
        rarity: 3,
        sources: [{ title: 'Тестове джерело' }],
        correctionIds: ['c_fx0002'],
        retired: false,
      });
      expect((await content.firstWord())?.id).toBe('w_fx0002');
    });
  });

  it('round-trips a full Correction: every field written to the pack comes back from the Core', async () => {
    const outFile = packPath();
    const authored = readJsonFile(join(fixture('valid'), 'content/corrections/c_fx0001.json'));
    // The fixture must fill every Correction field, so a new field can't skip the pack.
    expect(Object.keys(authored).toSorted()).toEqual(
      Object.keys(CorrectionSchema.shape).toSorted(),
    );

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withContent(outFile, async (content) => {
      expect(await content.correctionById('c_fx0001')).toEqual(authored);
    });
  });

  it('returns a Correction with its standard equivalents, the main one first', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withContent(outFile, async (content) => {
      expect(await content.correctionById('c_fx0002')).toEqual({
        kind: 'correction',
        id: 'c_fx0002',
        nonStandardForm: 'разговорчивий',
        correctionType: 'russianism',
        standardEquivalents: ['балакучий', 'говіркий'],
        explanation: 'Тестове пояснення.',
        examplePair: {
          nonStandard: 'Який він разговорчивий!',
          standard: 'Який він балакучий!',
        },
        sources: [{ title: 'Тестове джерело' }],
      });
      expect(await content.correctionById('c_missing')).toBeUndefined();
    });
  });

  it('reaches a Word ↔ Correction link in both directions', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withContent(outFile, async (content) => {
      const ids = (entries: readonly { id: string }[]) => entries.map(({ id }) => id);
      expect(ids(await content.linkedCorrections('w_fx0002'))).toEqual(['c_fx0002']);
      expect(ids(await content.linkedWords('c_fx0002'))).toEqual(['w_fx0002']);
      expect(ids(await content.linkedCorrections('w_fx0003'))).toEqual(['c_fx0001']);
      expect(ids(await content.linkedWords('c_fx0001'))).toEqual(['w_fx0003']);
      expect(await content.linkedWords('c_fx0004')).toEqual([]);
    });
  });

  it('keeps the links of a Retired Word, but leaves it out of the Words linked to a Correction', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withContent(outFile, async (content) => {
      expect((await content.linkedCorrections('w_fx0001')).map(({ id }) => id)).toEqual([
        'c_fx0003',
      ]);
      expect(await content.linkedWords('c_fx0003')).toEqual([]);
    });
  });

  it('round-trips a full Word: every field written to the pack comes back from the Core', async () => {
    const outFile = packPath();
    const authored = readJsonFile(join(fixture('valid'), 'content/words/w_fx0001.json'));
    // The fixture must fill every Word field, so a new field can't skip the pack.
    expect(Object.keys(authored).toSorted()).toEqual(Object.keys(WordSchema.shape).toSorted());

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0001')).toEqual(authored);
    });
  });

  it('round-trips a Word with two valid Stresses', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0003')).toMatchObject({
        lemma: 'завжди',
        stress: [1, 5],
      });
    });
  });

  it('round-trips a plural-only noun', async () => {
    const editionDir = copyFixture('valid');
    const pluralOnly = {
      kind: 'word',
      id: 'w_fx0004',
      lemma: 'ножиці',
      stress: [1],
      partOfSpeech: 'noun',
      gender: 'plural-only',
      primaryDefinition: 'Знаряддя для різання з двох лез.',
      categoryId: 'speech',
      rarity: 1,
      sources: [{ title: 'Тестове джерело' }],
    };
    writeFileSync(join(editionDir, 'content/words/w_fx0004.json'), JSON.stringify(pluralOnly));
    record(editionDir);
    const outFile = packPath();

    expect(buildLanguagePack({ editionDir, outFile }).ok).toBe(true);
    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0004')).toMatchObject(pluralOnly);
    });
  });

  it('keeps a Retired Word reachable by id but out of the first and random Words', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    expect((await readBack(outFile)).ids).toEqual(['w_fx0002', 'w_fx0003']);
    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0001')).toMatchObject({ retired: true });
      expect((await content.firstWord())?.id).toBe('w_fx0002');
    });
    // Across the whole range of the random port, only live Words come up.
    const picked = [];
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      picked.push(
        await withContent(
          outFile,
          async (content) => (await content.randomWord())?.id,
          fixedRandom(value),
        ),
      );
    }
    expect(picked).toEqual(['w_fx0002', 'w_fx0002', 'w_fx0003', 'w_fx0003', 'w_fx0003']);
  });

  it('fails on an invalid Word with an error naming the Entry id and field', () => {
    const errors = buildErrors(fixture('invalid-word'));

    expect(errors).toEqual([
      expect.objectContaining({ entryId: 'w_fx0002', field: 'partOfSpeech' }),
    ]);
    expect(errors.map(formatBuildError)).toEqual([expect.stringMatching(/w_fx0002.*partOfSpeech/)]);
  });

  describe('rejects broken Entries, naming the Entry id and the field', () => {
    const errors = () => buildErrors(fixture('invalid-entries'));

    it.each([
      ['a duplicate id', 'w_fx1001_copy.json', 'w_fx1001', 'id', /duplicate.*w_fx1001\.json/i],
      [
        'a Word that repeats the Lemma and primary Definition of another Word',
        'w_fx1015.json',
        'w_fx1015',
        'primaryDefinition',
        /same lemma and primary definition as w_fx1014/i,
      ],
      ['a Lemma that is not in Unicode NFC', 'w_fx1016.json', 'w_fx1016', 'lemma', /NFC/],
      [
        'a Stress mark written into the Lemma',
        'w_fx1017.json',
        'w_fx1017',
        'lemma',
        /combining mark U\+0301/i,
      ],
      [
        'a Lemma with a letter outside the alphabet',
        'w_fx1018.json',
        'w_fx1018',
        'lemma',
        /"i" \(U\+0069\) is not a letter of the alphabet/i,
      ],
      [
        'a file name that differs from the id',
        'w_fx1021.json',
        'w_fx1022',
        'id',
        /named w_fx1022\.json/i,
      ],
      [
        'an unknown Category',
        'w_fx1002.json',
        'w_fx1002',
        'categoryId',
        /unknown category.*space/i,
      ],
      [
        'a missing Stress in a Stress-marking Edition',
        'w_fx1003.json',
        'w_fx1003',
        'stress',
        /required/i,
      ],
      ['a Stress position out of range', 'w_fx1004.json', 'w_fx1004', 'stress.0', /out of range/i],
      ['a Stress position on a consonant', 'w_fx1005.json', 'w_fx1005', 'stress.0', /not a vowel/i],
      ['Stress positions out of order', 'w_fx1011.json', 'w_fx1011', 'stress', /ascending/i],
      ['a rarity outside 1–5', 'w_fx1006.json', 'w_fx1006', 'rarity', /5/],
      ['a rarity that is not a whole number', 'w_fx1020.json', 'w_fx1020', 'rarity', /int/i],
      ['an unknown field', 'w_fx1019.json', 'w_fx1019', 'lemmma', /unknown field/i],
      [
        'a missing primary Definition',
        'w_fx1007.json',
        'w_fx1007',
        'primaryDefinition',
        /expected string/i,
      ],
      ['a noun without gender', 'w_fx1008.json', 'w_fx1008', 'gender', /required for a noun/i],
      ['a gender on a non-noun', 'w_fx1012.json', 'w_fx1012', 'gender', /only nouns/i],
      ['a Word without sources', 'w_fx1009.json', 'w_fx1009', 'sources', /1/],
      ['an id without the Word prefix', 'word-10.json', 'word-10', 'id', /w_/],
      ['a repeated register label', 'w_fx1013.json', 'w_fx1013', 'registers', /repeat/i],
      [
        'a link to a Correction that does not exist',
        'w_fx1014.json',
        'w_fx1014',
        'correctionIds.1',
        /unknown correction.*c_fx9999/i,
      ],
    ])('%s', (_rule, file, entryId, field, message) => {
      expect(errors()).toContainEqual({
        file: `content/words/${file}`,
        entryId,
        field,
        message: expect.stringMatching(message) as string,
      });
    });

    it.each([
      [
        'a Correction without standard equivalents',
        'c_fx1001.json',
        'c_fx1001',
        'standardEquivalents',
        /1/,
      ],
      ['an unknown Correction Type', 'c_fx1002.json', 'c_fx1002', 'correctionType', /russianism/],
      [
        'repeated standard equivalents',
        'c_fx1003.json',
        'c_fx1003',
        'standardEquivalents',
        /repeat/i,
      ],
      ['an id without the Correction prefix', 'correction-4.json', 'correction-4', 'id', /c_/],
    ])('%s', (_rule, file, entryId, field, message) => {
      expect(errors()).toContainEqual({
        file: `content/corrections/${file}`,
        entryId,
        field,
        message: expect.stringMatching(message) as string,
      });
    });

    it('rejects a file that is not an Entry file', () => {
      expect(errors()).toContainEqual({
        file: 'content/words/notes.txt',
        message: expect.stringMatching(/<id>\.json/) as string,
      });
    });

    it('rejects an Entry whose id is not in the registry', () => {
      expect(errors()).toContainEqual({
        file: 'content/words/w_fx1023.json',
        entryId: 'w_fx1023',
        field: 'id',
        message: expect.stringMatching(/not in content\/ids\.json/i) as string,
      });
    });

    it('rejects a known id that has no file', () => {
      expect(errors()).toContainEqual({
        file: 'content/ids.json',
        entryId: 'w_fx1099',
        message: expect.stringMatching(/no file/i) as string,
      });
    });

    it('reports nothing but those errors', () => {
      // The copy with a duplicate id is also misnamed, so it fails twice.
      expect(errors()).toHaveLength(29);
    });
  });

  it('requires the vowels of an Edition that marks Stress', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: { ...(config['languageTraits'] as Json), vowels: undefined },
    }));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'edition.json',
        field: 'languageTraits.vowels',
        message: expect.stringMatching(/marks stress/i) as string,
      },
    ]);
  });

  it('builds Words without Stress in an Edition that does not mark Stress', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: {
        ...(config['languageTraits'] as Json),
        marksStress: false,
        vowels: undefined,
      },
    }));
    for (const file of validWordFiles) {
      editJson(editionDir, file, (word) => ({ ...word, stress: undefined }));
    }
    record(editionDir);
    const outFile = packPath();

    expect(buildLanguagePack({ editionDir, outFile }).ok).toBe(true);
    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0003')).toMatchObject({ stress: [] });
    });
  });

  it('rejects Stress in an Edition that does not mark Stress', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: {
        ...(config['languageTraits'] as Json),
        marksStress: false,
        vowels: undefined,
      },
    }));

    expect(buildErrors(editionDir)).toEqual(
      ['w_fx0001', 'w_fx0002', 'w_fx0003'].map((entryId) => ({
        file: `content/words/${entryId}.json`,
        entryId,
        field: 'stress',
        message: expect.stringMatching(/does not mark stress/i) as string,
      })),
    );
  });

  it('rejects a Correction id already used by another Correction', () => {
    const editionDir = copyFixture('valid');
    const copy = readJsonFile(join(editionDir, 'content/corrections/c_fx0002.json'));
    writeFileSync(join(editionDir, 'content/corrections/c_fx0002_copy.json'), JSON.stringify(copy));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/corrections/c_fx0002_copy.json',
        entryId: 'c_fx0002',
        field: 'id',
        message: expect.stringMatching(/named c_fx0002\.json/i) as string,
      },
      {
        file: 'content/corrections/c_fx0002_copy.json',
        entryId: 'c_fx0002',
        field: 'id',
        message: expect.stringMatching(/duplicate.*c_fx0002\.json/i) as string,
      },
    ]);
  });

  it('builds a Lemma with a capital letter, its Stress on a capital vowel', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0003.json', (word) => ({
      ...word,
      lemma: 'Аврора',
      stress: [0, 3],
    }));
    record(editionDir);
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir, outFile });

    expect(result.ok ? [] : result.errors).toEqual([]);
    await withContent(outFile, async (content) => {
      expect(await content.wordById('w_fx0003')).toMatchObject({ lemma: 'Аврора' });
    });
  });

  it('accepts in a Lemma only the punctuation the Edition allows', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
      ...word,
      lemma: "п'ятий-десятий",
      stress: [2],
    }));
    record(editionDir);
    const result = buildLanguagePack({ editionDir, outFile: packPath() });
    expect(result.ok ? [] : result.errors).toEqual([]);

    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: { ...(config['languageTraits'] as Json), lemmaPunctuation: "'" },
    }));
    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/words/w_fx0002.json',
        entryId: 'w_fx0002',
        field: 'lemma',
        message: expect.stringMatching(/"-" \(U\+002D\) is not a letter/) as string,
      },
    ]);
  });

  it('builds homonyms, and a Word that takes over from a Retired Word', () => {
    const editionDir = copyFixture('valid');
    const write = (word: Json) => {
      writeFileSync(
        join(editionDir, `content/words/${String(word['id'])}.json`),
        JSON.stringify(word),
      );
    };
    const retired = readJsonFile(join(editionDir, 'content/words/w_fx0001.json'));
    const live = readJsonFile(join(editionDir, 'content/words/w_fx0002.json'));
    write({ ...retired, id: 'w_fx0004', retired: false, correctionIds: [] });
    write({ ...live, id: 'w_fx0005', primaryDefinition: 'Інше значення.', correctionIds: [] });
    record(editionDir);

    const result = buildLanguagePack({ editionDir, outFile: packPath() });
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(['content/words', 'content/corrections'])(
    'fails when the %s folder is missing instead of building without it',
    (dir) => {
      const editionDir = copyFixture('valid');
      renameSync(join(editionDir, dir), join(editionDir, `${dir}-renamed`));

      expect(buildErrors(editionDir)).toContainEqual({
        file: dir,
        message: expect.stringMatching(/folder not found/i) as string,
      });
    },
  );

  it('rejects a nested folder or a file with another extension among the Entry files', () => {
    const editionDir = copyFixture('valid');
    mkdirSync(join(editionDir, 'content/words/more'));
    renameSync(
      join(editionDir, 'content/words/w_fx0002.json'),
      join(editionDir, 'content/words/w_fx0002.JSON'),
    );

    expect(buildErrors(editionDir)).toEqual(
      expect.arrayContaining(
        ['content/words/more', 'content/words/w_fx0002.JSON'].map((file) => ({
          file,
          message: expect.stringMatching(/<id>\.json/) as string,
        })),
      ),
    );
  });

  it('reports Words per Category, the rarity histogram and field coverage', () => {
    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile: packPath() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report).toEqual({
      words: 2,
      retiredWords: 1,
      wordsPerCategory: [
        { categoryId: 'nature', displayName: 'Природа', words: 0 },
        { categoryId: 'speech', displayName: 'Мовлення', words: 2 },
      ],
      rarity: [
        { rarity: 1, words: 1 },
        { rarity: 2, words: 0 },
        { rarity: 3, words: 1 },
        { rarity: 4, words: 0 },
        { rarity: 5, words: 0 },
      ],
      coverage: { examples: 1, synonyms: 1, etymology: 0, stress: 2 },
      corrections: 4,
      correctionsPerType: [
        { correctionType: 'russianism', corrections: 2 },
        { correctionType: 'calque', corrections: 0 },
        { correctionType: 'surzhyk', corrections: 1 },
        { correctionType: 'officialese', corrections: 1 },
      ],
    });
    const printed = formatContentReport(result.report);
    expect(printed).toMatch(/Words:\s+2 \(1 Retired Word left out\)/);
    expect(printed).toMatch(/speech\s.*Мовлення\s+2/);
    expect(printed).toMatch(/rarity 3\s+1/);
    expect(printed).toMatch(/Examples\s+1\/2 \(50%\)/);
    expect(printed).toMatch(/etymology\s+0\/2 \(0%\)/);
    expect(printed).toMatch(/Stress\s+2\/2 \(100%\)/);
    expect(printed).toMatch(/Corrections:\s+4/);
    expect(printed).toMatch(/russianism\s+2/);
    expect(printed).toMatch(/calque\s+0/);
  });

  it('rounds coverage down in the printed report, so 100% means every Word', () => {
    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile: packPath() });
    if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));

    const printed = formatContentReport({
      ...result.report,
      words: 521,
      coverage: { examples: 519, synonyms: 2, etymology: 0, stress: 521 },
    });

    expect(printed).toMatch(/Examples\s+519\/521 \(99%\)/);
    expect(printed).toMatch(/Synonyms\s+2\/521 \(0%\)/);
    expect(printed).toMatch(/Stress\s+521\/521 \(100%\)/);
  });

  it('yields the same ids, checksum and file when the same content is built twice', async () => {
    const first = packPath();
    const second = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile: first });
    buildLanguagePack({ editionDir: fixture('valid'), outFile: second });

    const a = await readBack(first);
    const b = await readBack(second);
    expect(a.ids).toEqual(['w_fx0002', 'w_fx0003']);
    expect(b.ids).toEqual(a.ids);
    expect(a.metadata).toEqual({
      editionId: 'fixture',
      contentVersion: 3,
      checksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
    });
    expect(b.metadata).toEqual(a.metadata);
    expect(readFileSync(second).equals(readFileSync(first))).toBe(true);
  });

  it.each([
    ['a Word', 'content/words/w_fx0001.json', { primaryDefinition: 'Інше значення.' }],
    ['a Correction', 'content/corrections/c_fx0004.json', { standardEquivalents: ['нині'] }],
  ])(
    'fails when %s changed and the content version was not raised',
    (_kind, file, change: Json) => {
      const editionDir = copyFixture('valid');
      editJson(editionDir, file, (entry) => ({ ...entry, ...change }));

      expect(buildErrors(editionDir)).toEqual([
        {
          file: 'content/manifest.json',
          field: 'checksum',
          message: expect.stringMatching(
            /content changed since content version 3.*pnpm build:pack fixture --record/i,
          ) as string,
        },
      ]);
    },
  );

  it('fails when the manifest records no checksum', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/manifest.json', () => ({ contentVersion: 3 }));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/manifest.json',
        field: 'checksum',
        message: expect.stringMatching(/not recorded.*--record/i) as string,
      },
    ]);
  });
});

describe('the id registry', () => {
  const registryOf = (editionDir: string) =>
    JSON.parse(readFileSync(join(editionDir, 'content/ids.json'), 'utf8')) as string[];

  it('fails when a known id has no file, so the id is never freed for another Entry', () => {
    const editionDir = copyFixture('valid');
    rmSync(join(editionDir, 'content/words/w_fx0002.json'));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/ids.json',
        entryId: 'w_fx0002',
        message: expect.stringMatching(/no file content\/words\/w_fx0002\.json.*retire/i) as string,
      },
    ]);
  });

  it('fails on an Entry whose id is not in the registry yet', () => {
    const editionDir = copyFixture('valid');
    const word = readJsonFile(join(editionDir, 'content/words/w_fx0002.json'));
    writeFileSync(
      join(editionDir, 'content/words/w_fx0004.json'),
      JSON.stringify({ ...word, id: 'w_fx0004', primaryDefinition: 'Нове значення.' }),
    );

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/words/w_fx0004.json',
        entryId: 'w_fx0004',
        field: 'id',
        message: expect.stringMatching(/not in content\/ids\.json.*--record/i) as string,
      },
    ]);
  });

  it('fails without a registry', () => {
    const editionDir = copyFixture('valid');
    rmSync(join(editionDir, 'content/ids.json'));

    expect(buildErrors(editionDir)).toEqual([
      { file: 'content/ids.json', message: expect.stringMatching(/not found/i) as string },
    ]);
  });

  it('rejects a registry that lists an id twice', () => {
    const editionDir = copyFixture('valid');
    const ids = registryOf(editionDir);
    writeFileSync(join(editionDir, 'content/ids.json'), JSON.stringify([...ids, ids[0]]));

    expect(buildErrors(editionDir)).toEqual([
      { file: 'content/ids.json', message: expect.stringMatching(/repeat/i) as string },
    ]);
  });
});

describe('recordContent', () => {
  const registryOf = (editionDir: string) =>
    JSON.parse(readFileSync(join(editionDir, 'content/ids.json'), 'utf8')) as string[];
  const manifestOf = (editionDir: string) =>
    readJsonFile(join(editionDir, 'content/manifest.json'));

  it('leaves recorded content as it is', () => {
    const editionDir = copyFixture('valid');
    const manifest = readFileSync(join(editionDir, 'content/manifest.json'), 'utf8');
    const registry = readFileSync(join(editionDir, 'content/ids.json'), 'utf8');

    expect(recordContent({ editionDir })).toEqual({
      ok: true,
      previousContentVersion: 3,
      contentVersion: 3,
      checksum: manifestOf(editionDir)['checksum'],
      newIds: [],
    });
    expect(readFileSync(join(editionDir, 'content/manifest.json'), 'utf8')).toBe(manifest);
    expect(readFileSync(join(editionDir, 'content/ids.json'), 'utf8')).toBe(registry);
  });

  it('raises the content version of changed content and records its checksum', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, rarity: 4 }));
    const original = packPath();
    const edited = packPath();
    buildLanguagePack({ editionDir: fixture('valid'), outFile: original });

    const recorded = recordContent({ editionDir });
    const result = buildLanguagePack({ editionDir, outFile: edited });

    expect(recorded).toMatchObject({ ok: true, previousContentVersion: 3, contentVersion: 4 });
    expect(result.ok).toBe(true);
    const { metadata } = await readBack(edited);
    expect(metadata).toMatchObject({ contentVersion: 4 });
    expect(manifestOf(editionDir)).toEqual({ contentVersion: 4, checksum: metadata.checksum });
    expect(metadata.checksum).not.toBe((await readBack(original)).metadata.checksum);
  });

  it('adds new ids to the end of the registry and keeps every known one', () => {
    const editionDir = copyFixture('valid');
    const known = registryOf(editionDir);
    const word = readJsonFile(join(editionDir, 'content/words/w_fx0002.json'));
    for (const id of ['w_fx0005', 'w_fx0004']) {
      writeFileSync(
        join(editionDir, `content/words/${id}.json`),
        JSON.stringify({ ...word, id, primaryDefinition: `Значення ${id}.`, correctionIds: [] }),
      );
    }

    expect(recordContent({ editionDir })).toMatchObject({
      ok: true,
      newIds: ['w_fx0004', 'w_fx0005'],
    });
    expect(registryOf(editionDir)).toEqual([...known, 'w_fx0004', 'w_fx0005']);
  });

  it('keeps the id of a Word that was retired instead of deleted', () => {
    const editionDir = copyFixture('valid');
    const known = registryOf(editionDir);
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, retired: true }));

    record(editionDir);

    expect(registryOf(editionDir)).toEqual(known);
    expect(buildLanguagePack({ editionDir, outFile: packPath() }).ok).toBe(true);
  });

  it('records nothing while a known id has no file', () => {
    const editionDir = copyFixture('valid');
    rmSync(join(editionDir, 'content/words/w_fx0002.json'));
    const manifest = readFileSync(join(editionDir, 'content/manifest.json'), 'utf8');

    expect(recordContent({ editionDir })).toEqual({
      ok: false,
      errors: [expect.objectContaining({ file: 'content/ids.json', entryId: 'w_fx0002' })],
    });
    expect(readFileSync(join(editionDir, 'content/manifest.json'), 'utf8')).toBe(manifest);
  });

  it('records nothing while the content has errors', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, rarity: 9 }));

    expect(recordContent({ editionDir })).toEqual({
      ok: false,
      errors: [expect.objectContaining({ entryId: 'w_fx0002', field: 'rarity' })],
    });
    expect(manifestOf(editionDir)).toMatchObject({ contentVersion: 3 });
  });

  it('starts the registry of an Edition that has none with every id, in order', () => {
    const editionDir = copyFixture('valid');
    rmSync(join(editionDir, 'content/ids.json'));

    expect(recordContent({ editionDir })).toMatchObject({ ok: true, contentVersion: 3 });
    expect(registryOf(editionDir)).toEqual([
      'c_fx0001',
      'c_fx0002',
      'c_fx0003',
      'c_fx0004',
      'w_fx0001',
      'w_fx0002',
      'w_fx0003',
    ]);
  });
});

describe('content targets', () => {
  /** A copy of the valid fixture: 2 live Words (rarity 1 and 3, both in "speech"), 4 Corrections. */
  function editionWithTargets(targets: Json): string {
    const editionDir = copyFixture('valid');
    writeFileSync(join(editionDir, 'content/targets.json'), JSON.stringify(targets));
    return editionDir;
  }

  function missedTargets(editionDir: string) {
    const result = buildLanguagePack({ editionDir, outFile: packPath() });
    if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
    return result.missedTargets;
  }

  it('misses nothing when the content meets every target the Edition declares', () => {
    const editionDir = editionWithTargets({
      minWords: 2,
      minCorrections: 4,
      minWordsPerCategory: 0,
      everyWordHasStress: true,
    });

    expect(missedTargets(editionDir)).toEqual([]);
  });

  it('misses the Word count when there are fewer live Words than the target', () => {
    const editionDir = editionWithTargets({ minWords: 3 });

    expect(missedTargets(editionDir)).toEqual([
      { target: 'minWords', message: '2 Words, below the target of 3' },
    ]);
  });

  it('misses the Correction count when there are fewer Corrections than the target', () => {
    const editionDir = editionWithTargets({ minCorrections: 5 });

    expect(missedTargets(editionDir)).toEqual([
      { target: 'minCorrections', message: '4 Corrections, below the target of 5' },
    ]);
  });

  it('misses the per-Category target, naming every Category that falls short', () => {
    const editionDir = editionWithTargets({ minWordsPerCategory: 1 });

    expect(missedTargets(editionDir)).toEqual([
      {
        target: 'minWordsPerCategory',
        message: 'Category "nature" has 0 Words, below the target of 1',
      },
    ]);
  });

  it('misses the rarity target, naming every rarity without Words', () => {
    const editionDir = editionWithTargets({ everyRarity: true });

    expect(missedTargets(editionDir)).toEqual([
      { target: 'everyRarity', message: 'No Words of rarity 2, 4, 5' },
    ]);
  });

  it('meets the rarity target once every rarity has a Word', () => {
    const editionDir = editionWithTargets({ everyRarity: true });
    const word = readJsonFile(join(editionDir, 'content/words/w_fx0002.json'));
    for (const rarity of [2, 4, 5]) {
      const id = `w_fxr00${String(rarity)}`;
      writeFileSync(
        join(editionDir, `content/words/${id}.json`),
        JSON.stringify({
          ...word,
          id,
          rarity,
          primaryDefinition: `Значення рідкісності ${String(rarity)}.`,
          correctionIds: [],
        }),
      );
    }
    record(editionDir);

    expect(missedTargets(editionDir)).toEqual([]);
  });

  it('misses the Stress target when Words have no Stress', () => {
    const editionDir = editionWithTargets({ everyWordHasStress: true });
    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: {
        ...(config['languageTraits'] as Json),
        marksStress: false,
        vowels: undefined,
      },
    }));
    for (const file of validWordFiles) {
      editJson(editionDir, file, (word) => ({ ...word, stress: undefined }));
    }
    record(editionDir);

    expect(missedTargets(editionDir)).toEqual([
      { target: 'everyWordHasStress', message: '2 of 2 Words have no Stress' },
    ]);
  });

  it('declares no targets when the Edition has no targets file', () => {
    expect(missedTargets(fixture('valid'))).toEqual([]);
  });

  it('rejects a targets file it cannot read, so a typo never switches a target off', () => {
    const editionDir = editionWithTargets({ minWords: 2, minWordz: 900 });

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/targets.json',
        field: 'minWordz',
        message: expect.stringMatching(/unknown field/i) as string,
      },
    ]);
  });
});
