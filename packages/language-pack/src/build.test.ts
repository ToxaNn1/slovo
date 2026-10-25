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
import { buildWordCard, createEntries, type Entries } from '@slovo/core';

import {
  buildLanguagePack,
  checkLanguagePack,
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

/** Reads the pack through the Core's Entries, with every Feature Switch on. */
async function withEntries<T>(outFile: string, use: (entries: Entries) => Promise<T>): Promise<T> {
  const pack = openLanguagePack(outFile);
  try {
    return await use(createEntries({ content: pack, edition: { isFeatureEnabled: () => true } }));
  } finally {
    pack.close();
  }
}

/** The ids of the live Corrections linked to the Word with the given id. */
async function linkedIds(entries: Entries, id: string): Promise<string[]> {
  const word = await entries.get(id);
  if (word?.kind !== 'word') throw new Error(`No Word ${id}`);
  return (await entries.linkedCorrections(word)).map((correction) => correction.id);
}

/** Adds a stress trap, a wrong-stress Correction, to a copy of the valid fixture. */
function addStressTrap(editionDir: string): void {
  const stressTrap = {
    id: 'c_fx0005',
    nonStandardForm: 'ката\u0301лог',
    correctionType: 'wrongStress',
    standardEquivalents: ['катало\u0301г'],
    explanation: 'Тестове пояснення.',
    examplePair: { nonStandard: 'Я шукаю ката\u0301лог.', standard: 'Я шукаю катало\u0301г.' },
    sources: [{ title: 'Тестове джерело' }],
  };
  writeFileSync(join(editionDir, 'content/corrections/c_fx0005.json'), JSON.stringify(stressTrap));
  const idsPath = join(editionDir, 'content/ids.json');
  const ids = JSON.parse(readFileSync(idsPath, 'utf8')) as string[];
  writeFileSync(idsPath, JSON.stringify([...ids, 'c_fx0005']));
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
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0002')).toEqual({
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
      expect((await entries.eligible()).words[0]).toBe('w_fx0002');
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

    await withEntries(outFile, async (entries) => {
      expect(await entries.get('c_fx0001')).toEqual(authored);
    });
  });

  it('returns a Correction with its standard equivalents, the main one first', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withEntries(outFile, async (entries) => {
      expect(await entries.get('c_fx0002')).toEqual({
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
        retired: false,
      });
      expect(await entries.get('c_missing')).toBeUndefined();
    });
  });

  it('reaches the Corrections a Word links', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withEntries(outFile, async (entries) => {
      expect(await linkedIds(entries, 'w_fx0002')).toEqual(['c_fx0002']);
      expect(await linkedIds(entries, 'w_fx0003')).toEqual(['c_fx0001']);
    });
  });

  it('keeps the links of a Retired Word', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withEntries(outFile, async (entries) => {
      expect(await linkedIds(entries, 'w_fx0001')).toEqual(['c_fx0003']);
    });
  });

  it('keeps a Retired Correction reachable by id, but out of the Corrections linked to a Word and out of the counts', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/corrections/c_fx0002.json', (correction) => ({
      ...correction,
      retired: true,
    }));
    record(editionDir);
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir, outFile });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report).toMatchObject({ corrections: 3, retiredCorrections: 1 });
    expect(formatContentReport(result.report)).toMatch(
      /Corrections:\s+3 \(1 Retired Correction left out\)/,
    );
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('c_fx0002')).toMatchObject({ retired: true });
      expect(await linkedIds(entries, 'w_fx0002')).toEqual([]);
    });
  });

  it('lists the ids of the live Corrections in a stable order, leaving a Retired Correction out', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/corrections/c_fx0002.json', (correction) => ({
      ...correction,
      retired: true,
    }));
    record(editionDir);
    const outFile = packPath();
    buildLanguagePack({ editionDir, outFile });

    const pack = openLanguagePack(outFile);
    try {
      expect(await pack.listCorrectionIds()).toEqual(['c_fx0001', 'c_fx0003', 'c_fx0004']);
    } finally {
      pack.close();
    }
  });

  it('round-trips a full Word: every field written to the pack comes back from the Core', async () => {
    const outFile = packPath();
    const authored = readJsonFile(join(fixture('valid'), 'content/words/w_fx0001.json'));
    // The fixture must fill every Word field, so a new field can't skip the pack.
    expect(Object.keys(authored).toSorted()).toEqual(Object.keys(WordSchema.shape).toSorted());

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0001')).toEqual(authored);
    });
  });

  it('round-trips a Word with two valid Stresses', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0003')).toMatchObject({
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
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0004')).toMatchObject(pluralOnly);
    });
  });

  it('keeps a Retired Word reachable by id but out of the eligible Words', async () => {
    const outFile = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile });

    expect((await readBack(outFile)).ids).toEqual(['w_fx0002', 'w_fx0003']);
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0001')).toMatchObject({ retired: true });
      expect((await entries.eligible()).words).toEqual(['w_fx0002', 'w_fx0003']);
    });
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
        'a region on a Word without the dialectal register label',
        'w_fx1024.json',
        'w_fx1024',
        'region',
        /only a dialect word/i,
      ],
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
      [
        'a wrong-stress Correction whose non-standard form has no Stress mark',
        'c_fx1010.json',
        'c_fx1010',
        'nonStandardForm',
        /required.*stress mark/i,
      ],
      [
        'a wrong-stress Correction whose standard equivalent has no Stress mark',
        'c_fx1006.json',
        'c_fx1006',
        'standardEquivalents.0',
        /required.*stress mark/i,
      ],
      [
        'a Stress mark after a consonant',
        'c_fx1007.json',
        'c_fx1007',
        'nonStandardForm',
        /"т", not a vowel/i,
      ],
      [
        'a wrong-stress Correction whose forms differ in more than their Stress',
        'c_fx1008.json',
        'c_fx1008',
        'standardEquivalents.0',
        /only in .*stress/i,
      ],
      [
        'a Stress mark in a Correction of another type',
        'c_fx1009.json',
        'c_fx1009',
        'nonStandardForm',
        /only a wrong-stress correction/i,
      ],
    ])('%s', (_rule, file, entryId, field, message) => {
      expect(errors()).toContainEqual({
        file: `content/corrections/${file}`,
        entryId,
        field,
        message: expect.stringMatching(message) as string,
      });
    });

    it.each([
      ['an expression that is not in Unicode NFC', 'i_fx1001', 'expression', /NFC/],
      [
        'an expression with a letter outside the alphabet',
        'i_fx1002',
        'expression',
        /"i" \(U\+0069\) is not a letter/,
      ],
      [
        'an expression with a capital letter outside the alphabet',
        'i_fx1003',
        'expression',
        /"T" \(U\+0054\) is not a letter/,
      ],
      ['a place name without an etymology', 'i_fx1004', 'etymology', /required for a place name/i],
      [
        'an Idiom that repeats the expression of another, in another case',
        'i_fx1006',
        'expression',
        /same expression as i_fx1005/i,
      ],
    ])('%s', (_rule, entryId, field, message) => {
      expect(errors()).toContainEqual({
        file: `content/idioms/${entryId}.json`,
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
      // The copy with a duplicate id is also misnamed, so it fails twice; the
      // surzhyk Correction with a Stress mark fails for its form and its example.
      expect(errors()).toHaveLength(41);
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
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0003')).toMatchObject({ stress: [] });
    });
  });

  it('rejects a wrong-stress Correction in an Edition that does not mark Stress', () => {
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
    addStressTrap(editionDir);

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/corrections/c_fx0005.json',
        entryId: 'c_fx0005',
        field: 'correctionType',
        message: expect.stringMatching(/does not mark stress/i) as string,
      },
    ]);
  });

  it('builds a wrong-stress Correction whose texts keep their Stress marks', async () => {
    const editionDir = copyFixture('valid');
    addStressTrap(editionDir);
    record(editionDir);
    const outFile = packPath();

    expect(buildLanguagePack({ editionDir, outFile }).ok).toBe(true);
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('c_fx0005')).toMatchObject({
        correctionType: 'wrongStress',
        nonStandardForm: 'ката\u0301лог',
        standardEquivalents: ['катало\u0301г'],
        examplePair: {
          nonStandard: 'Я шукаю ката\u0301лог.',
          standard: 'Я шукаю катало\u0301г.',
        },
      });
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
    await withEntries(outFile, async (entries) => {
      expect(await entries.get('w_fx0003')).toMatchObject({ lemma: 'Аврора' });
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

  it('builds an Idiom that takes over the expression of a Retired Idiom', () => {
    const editionDir = copyFixture('valid');
    const idiom = readJsonFile(join(editionDir, 'content/idioms/i_fx0001.json'));
    editJson(editionDir, 'content/idioms/i_fx0001.json', (retired) => ({
      ...retired,
      retired: true,
    }));
    writeFileSync(
      join(editionDir, 'content/idioms/i_fx0003.json'),
      JSON.stringify({ ...idiom, id: 'i_fx0003', expression: 'Бити байдики' }),
    );
    record(editionDir);

    const result = buildLanguagePack({ editionDir, outFile: packPath() });
    expect(result.ok ? [] : result.errors).toEqual([]);
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
      coverage: { examples: 1, synonyms: 1, etymology: 0, stress: 2, region: 0 },
      corrections: 4,
      retiredCorrections: 0,
      correctionsPerType: [
        { correctionType: 'russianism', corrections: 2 },
        { correctionType: 'calque', corrections: 0 },
        { correctionType: 'surzhyk', corrections: 1 },
        { correctionType: 'officialese', corrections: 1 },
        { correctionType: 'anglicism', corrections: 0 },
        { correctionType: 'wrongStress', corrections: 0 },
      ],
      idioms: 2,
      retiredIdioms: 0,
      idiomsPerType: [
        { idiomType: 'idiom', idioms: 1 },
        { idiomType: 'placeName', idioms: 1 },
      ],
    });
    const printed = formatContentReport(result.report);
    expect(printed).toMatch(/Words:\s+2 \(1 Retired Word left out\)/);
    expect(printed).toMatch(/speech\s.*Мовлення\s+2/);
    expect(printed).toMatch(/rarity 3\s+1/);
    expect(printed).toMatch(/Examples\s+1\/2 \(50%\)/);
    expect(printed).toMatch(/etymology\s+0\/2 \(0%\)/);
    expect(printed).toMatch(/Stress\s+2\/2 \(100%\)/);
    expect(printed).toMatch(/Corrections:\s+4 \(0 Retired Corrections left out\)/);
    expect(printed).toMatch(/russianism\s+2/);
    expect(printed).toMatch(/calque\s+0/);
    expect(printed).toMatch(/Idioms:\s+2 \(0 Retired Idioms left out\)/);
    expect(printed).toMatch(/Idioms per Idiom Type:\n\s+idiom\s+1\n\s+placeName\s+1/);
  });

  it('counts the Words with a region, and gives a dialect Word card its region', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
      ...word,
      registers: ['dialectal'],
      region: 'Гуцульщина',
    }));
    record(editionDir);
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir, outFile });

    if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
    expect(result.report.coverage.region).toBe(1);
    expect(formatContentReport(result.report)).toMatch(/region\s+1\/2 \(50%\)/);
    await withEntries(outFile, async (entries) => {
      const word = await entries.get('w_fx0002');
      if (word?.kind !== 'word') throw new Error('No Word w_fx0002');
      expect(await buildWordCard({ word, entries })).toMatchObject({
        registers: ['dialectal'],
        region: 'Гуцульщина',
      });
    });
  });

  it('rounds coverage down in the printed report, so 100% means every Word', () => {
    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile: packPath() });
    if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));

    const printed = formatContentReport({
      ...result.report,
      words: 521,
      coverage: { examples: 519, synonyms: 2, etymology: 0, stress: 521, region: 3 },
    });

    expect(printed).toMatch(/Examples\s+519\/521 \(99%\)/);
    expect(printed).toMatch(/Synonyms\s+2\/521 \(0%\)/);
    expect(printed).toMatch(/Stress\s+521\/521 \(100%\)/);
    expect(printed).toMatch(/region\s+3\/521 \(0%\)/);
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
      contentVersion: 4,
      contentChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
      packFormat: 3,
    });
    expect(b.metadata).toEqual(a.metadata);
    expect(readFileSync(second).equals(readFileSync(first))).toBe(true);
  });

  it('records the pack format in the pack and reports it from the build', async () => {
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile });

    expect(result).toMatchObject({ ok: true, metadata: { packFormat: 3 } });
    expect((await readBack(outFile)).metadata.packFormat).toBe(3);
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
          field: 'contentChecksum',
          message: expect.stringMatching(
            /content changed since content version 4.*pnpm build:pack fixture --record/i,
          ) as string,
        },
      ]);
    },
  );

  it('fails when a recorded checksum was copied without raising the content version', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, rarity: 4 }));
    record(editionDir);
    editJson(editionDir, 'content/manifest.json', (manifest) => ({
      ...manifest,
      contentVersion: 4,
    }));

    expect(buildErrors(editionDir)).toEqual([
      expect.objectContaining({ file: 'content/manifest.json', field: 'contentChecksum' }),
    ]);
  });

  it('fails when the manifest records no checksum', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/manifest.json', () => ({ contentVersion: 3 }));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/manifest.json',
        field: 'contentChecksum',
        message: expect.stringMatching(/not recorded.*--record/i) as string,
      },
    ]);
  });
});

describe('checkLanguagePack', () => {
  it('passes valid content with the targets it misses, as the build does', () => {
    const editionDir = copyFixture('valid');
    writeFileSync(join(editionDir, 'content/targets.json'), JSON.stringify({ minWords: 3 }));

    expect(checkLanguagePack({ editionDir })).toEqual({
      ok: true,
      missedTargets: [{ target: 'minWords', message: '2 Words, below the target of 3' }],
    });
  });

  it('refuses what the build refuses and writes no pack', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, rarity: 9 }));

    const result = checkLanguagePack({ editionDir });

    expect(result).toEqual({ ok: false, errors: buildErrors(editionDir) });
    expect(result.ok ? [] : result.errors).toEqual([
      expect.objectContaining({ file: 'content/words/w_fx0002.json', field: 'rarity' }),
    ]);
    expect(existsSync(join(editionDir, 'dist'))).toBe(false);
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
      previousContentVersion: 4,
      contentVersion: 4,
      contentChecksum: manifestOf(editionDir)['contentChecksum'],
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

    expect(recorded).toMatchObject({ ok: true, previousContentVersion: 4, contentVersion: 5 });
    expect(result.ok).toBe(true);
    const { metadata } = await readBack(edited);
    expect(metadata).toMatchObject({ contentVersion: 5 });
    expect(manifestOf(editionDir)).toEqual({
      contentVersion: 5,
      contentChecksum: metadata.contentChecksum,
    });
    expect(metadata.contentChecksum).not.toBe((await readBack(original)).metadata.contentChecksum);
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
    expect(manifestOf(editionDir)).toMatchObject({ contentVersion: 4 });
  });

  it('starts the registry of an Edition never recorded with every id, in order', () => {
    const editionDir = copyFixture('valid');
    rmSync(join(editionDir, 'content/ids.json'));
    writeFileSync(join(editionDir, 'content/manifest.json'), JSON.stringify({ contentVersion: 1 }));

    expect(recordContent({ editionDir })).toMatchObject({ ok: true, contentVersion: 2 });
    expect(registryOf(editionDir)).toEqual([
      'c_fx0001',
      'c_fx0002',
      'c_fx0003',
      'c_fx0004',
      'i_fx0001',
      'i_fx0002',
      'w_fx0001',
      'w_fx0002',
      'w_fx0003',
    ]);
  });
  it('refuses to start a registry for an Edition recorded before, whose ids may have shipped', () => {
    const editionDir = copyFixture('valid');
    rmSync(join(editionDir, 'content/ids.json'));
    const manifest = readFileSync(join(editionDir, 'content/manifest.json'), 'utf8');

    expect(recordContent({ editionDir })).toEqual({
      ok: false,
      errors: [
        {
          file: 'content/ids.json',
          message:
            'Missing, though the content was recorded before: restore it from git, since a new registry would free the ids of deleted Entries',
        },
      ],
    });
    expect(existsSync(join(editionDir, 'content/ids.json'))).toBe(false);
    expect(readFileSync(join(editionDir, 'content/manifest.json'), 'utf8')).toBe(manifest);
  });
});

describe('content targets', () => {
  /** A copy of the valid fixture: 2 live Words (rarity 1 and 3, both in "speech"), 4 Corrections, 2 Idioms. */
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
      minIdioms: 2,
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

  it('misses the Idiom count when there are fewer live Idioms than the target', () => {
    const editionDir = editionWithTargets({ minIdioms: 3 });

    expect(missedTargets(editionDir)).toEqual([
      { target: 'minIdioms', message: '2 Idioms, below the target of 3' },
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

  it('takes a Category floor over the per-Category target for the Categories it names', () => {
    const editionDir = editionWithTargets({
      minWordsPerCategory: 1,
      minWordsByCategory: { nature: 0 },
    });

    expect(missedTargets(editionDir)).toEqual([]);
  });

  it('misses a Category floor, naming the Category that falls short', () => {
    const editionDir = editionWithTargets({
      minWordsPerCategory: 0,
      minWordsByCategory: { speech: 3 },
    });

    expect(missedTargets(editionDir)).toEqual([
      {
        target: 'minWordsByCategory',
        message: 'Category "speech" has 2 Words, below the target of 3',
      },
    ]);
  });

  it('misses a Category floor for a Category the Edition does not have, so a typo never goes unseen', () => {
    const editionDir = editionWithTargets({ minWordsByCategory: { natrue: 0 } });

    expect(missedTargets(editionDir)).toEqual([
      { target: 'minWordsByCategory', message: 'No Category "natrue" in the Edition' },
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
