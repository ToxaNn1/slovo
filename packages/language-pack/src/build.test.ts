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
import { crc32, deflateSync } from 'node:zlib';

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
import { fontWith } from './test-support';

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
function record(editionDir: string, today = new Date()): void {
  const result = recordContent({ editionDir, today });
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
    categoryId: 'shop',
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
        categoryId: 'work',
        sources: [{ title: 'Тестове джерело' }],
        literaryUses: [],
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
      ['a Correction without a Category', 'c_fx1011.json', 'c_fx1011', 'categoryId', /string/],
      [
        "a Correction in a Category of Words, not one of the Corrections' Categories",
        'c_fx1012.json',
        'c_fx1012',
        'categoryId',
        /unknown category "speech"/i,
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
      expect(errors()).toHaveLength(43);
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

  it('refuses a word that mixes scripts, such as a Latin "i" in a Cyrillic word or between two', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
      ...word,
      primaryDefinition: 'Будь-що, сказане вiд себе.',
      examples: [{ text: 'Він сказав це вголос.' }, { text: 'Свiчка Iскри, луки i мечі.' }],
    }));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/words/w_fx0002.json',
        entryId: 'w_fx0002',
        field: 'primaryDefinition',
        message:
          'The word "вiд" mixes Cyrillic and Latin letters ("i" U+0069): write each word in one script',
      },
      {
        file: 'content/words/w_fx0002.json',
        entryId: 'w_fx0002',
        field: 'examples.1.text',
        message:
          'The word "Свiчка" mixes Cyrillic and Latin letters ("i" U+0069): write each word in one script',
      },
      {
        file: 'content/words/w_fx0002.json',
        entryId: 'w_fx0002',
        field: 'examples.1.text',
        message:
          'The word "Iскри" mixes Cyrillic and Latin letters ("I" U+0049): write each word in one script',
      },
      {
        file: 'content/words/w_fx0002.json',
        entryId: 'w_fx0002',
        field: 'examples.1.text',
        message:
          'The word "i" stands in Latin between Cyrillic words ("i" U+0069): write each word in one script',
      },
    ]);
  });

  it('builds an etymology that quotes forms of other languages in their scholarly spelling', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
      ...word,
      etymology: 'Від псл. *světъ, пор. лит. šviesà, нім. Welt; суфікс -t- і звук b.',
    }));
    record(editionDir);

    const result = buildLanguagePack({ editionDir, outFile: packPath() });
    expect(result.ok ? [] : result.errors).toEqual([]);
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

  it('builds a proverb, an Idiom of Idiom Type proverb, and reads it back', async () => {
    const editionDir = copyFixture('valid');
    const proverb = {
      id: 'i_fx0003',
      expression: 'хто рано встає, тому Бог дає',
      idiomType: 'proverb',
      primaryDefinition: 'Тестове значення: хто починає працю вчасно, тому щастить.',
      sources: [{ title: 'Тестове джерело' }],
    };
    writeFileSync(join(editionDir, 'content/idioms/i_fx0003.json'), JSON.stringify(proverb));
    record(editionDir);
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir, outFile });

    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(await withEntries(outFile, (entries) => entries.get('i_fx0003'))).toEqual({
      ...proverb,
      kind: 'idiom',
      extraDefinitions: [],
      examples: [],
      retired: false,
    });
  });

  describe('Tips', () => {
    /** A Tip with every field, the optional ones included. */
    const fullTip = {
      id: 't_fx0001',
      title: 'Котра година?',
      nonStandardForm: 'Скільки час?',
      standardForm: 'Котра година?',
      explanation: 'Тестове пояснення: про час питають порядковим числівником.',
      example: { text: 'Перепрошую, котра година?', author: 'Тестовий автор' },
      sources: [{ title: 'Тестове джерело', url: 'https://example.com/tips' }],
      gameQuestion: {
        prompt: 'Як правильно спитати про час?',
        rightAnswer: 'Котра година?',
        wrongAnswers: ['Скільки час?', 'Скільки годин?', 'Який час?'],
      },
    };

    function withTips(tips: Json[]): string {
      const editionDir = copyFixture('valid');
      mkdirSync(join(editionDir, 'content/tips'), { recursive: true });
      for (const tip of tips) {
        writeFileSync(
          join(editionDir, `content/tips/${String(tip['id'])}.json`),
          JSON.stringify(tip),
        );
      }
      record(editionDir);
      return editionDir;
    }

    async function readTips(outFile: string, ids: string[]) {
      const pack = openLanguagePack(outFile);
      try {
        return await pack.getEntries(ids);
      } finally {
        pack.close();
      }
    }

    it('builds a Tip and reads it back with every field, in pack format 8', async () => {
      const editionDir = withTips([fullTip]);
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir, outFile });

      expect(result.ok ? [] : result.errors).toEqual([]);
      expect(result).toMatchObject({ ok: true, metadata: { packFormat: 8 } });
      expect(await readTips(outFile, ['t_fx0001'])).toEqual([
        { ...fullTip, kind: 'tip', retired: false },
      ]);
    });

    it('reads back a Retired Tip with no non-standard form and no example', async () => {
      const plainTip = {
        id: 't_fx0002',
        title: 'Кличний відмінок у звертанні',
        standardForm: 'пане Андрію',
        explanation: 'Тестове пояснення: у звертанні вживаємо кличний відмінок.',
        sources: [{ title: 'Тестове джерело' }],
        gameQuestion: {
          prompt: 'Як звернутися до Андрія?',
          rightAnswer: 'пане Андрію',
          wrongAnswers: ['пан Андрій', 'пане Андрій', 'пан Андрію'],
        },
        retired: true,
      };
      const outFile = packPath();

      buildLanguagePack({ editionDir: withTips([plainTip]), outFile });

      expect(await readTips(outFile, ['t_fx0002'])).toEqual([{ ...plainTip, kind: 'tip' }]);
    });

    it('lists the ids of the live Tips, leaving a Retired one out', async () => {
      const outFile = packPath();
      const retired = { ...fullTip, id: 't_fx0002', retired: true };

      buildLanguagePack({ editionDir: withTips([fullTip, retired]), outFile });

      const pack = openLanguagePack(outFile);
      try {
        expect(await pack.listTipIds()).toEqual(['t_fx0001']);
      } finally {
        pack.close();
      }
    });

    it('keeps Tips out of the Entries the screens are given', async () => {
      const outFile = packPath();

      buildLanguagePack({ editionDir: withTips([fullTip]), outFile });

      expect(await withEntries(outFile, (entries) => entries.get('t_fx0001'))).toBeUndefined();
    });

    describe('refuses a bad Tip and says why', () => {
      const { gameQuestion } = fullTip;
      const withQuestion = (question: Json) => ({ ...fullTip, gameQuestion: question });
      const { gameQuestion: _, ...tipWithoutQuestion } = fullTip;

      /** The build's refusals for the Tip, which is written but not recorded. */
      function refusals(tip: Json) {
        const editionDir = copyFixture('valid');
        mkdirSync(join(editionDir, 'content/tips'), { recursive: true });
        writeFileSync(join(editionDir, 'content/tips/t_fx0001.json'), JSON.stringify(tip));
        const result = buildLanguagePack({ editionDir, outFile: packPath() });
        return result.ok ? [] : result.errors;
      }

      it.each<[string, Json, string, RegExp]>([
        [
          'an explanation over 300 characters',
          { ...fullTip, explanation: 'п'.repeat(301) },
          'explanation',
          /at most 300|<=300/i,
        ],
        ['no Game question', tipWithoutQuestion, 'gameQuestion', /expected object/i],
        [
          'a Game question without a right answer',
          withQuestion({ prompt: gameQuestion.prompt, wrongAnswers: gameQuestion.wrongAnswers }),
          'gameQuestion.rightAnswer',
          /expected string/i,
        ],
        [
          'a Game question with two wrong answers',
          withQuestion({ ...gameQuestion, wrongAnswers: gameQuestion.wrongAnswers.slice(0, 2) }),
          'gameQuestion.wrongAnswers',
          /3/,
        ],
        [
          'a Game question with four wrong answers',
          withQuestion({
            ...gameQuestion,
            wrongAnswers: [...gameQuestion.wrongAnswers, 'Яка година?'],
          }),
          'gameQuestion.wrongAnswers',
          /3/,
        ],
        [
          'a wrong answer that repeats the right one',
          withQuestion({
            ...gameQuestion,
            wrongAnswers: ['Скільки час?', 'Котра година?', 'Який час?'],
          }),
          'gameQuestion.wrongAnswers.1',
          /same answer as rightAnswer:/i,
        ],
        [
          'two wrong answers that are the same',
          withQuestion({
            ...gameQuestion,
            wrongAnswers: ['Скільки час?', 'Який час?', 'Скільки час?'],
          }),
          'gameQuestion.wrongAnswers.2',
          /same answer as wrongAnswers\.0:/i,
        ],
        ['no source', { ...fullTip, sources: [] }, 'sources', /at least 1|>=1/i],
      ])('%s', (_rule, tip, field, message) => {
        expect(refusals(tip)).toContainEqual({
          file: 'content/tips/t_fx0001.json',
          entryId: 't_fx0001',
          field,
          message: expect.stringMatching(message) as string,
        });
      });

      it('compares answers in lower case', () => {
        const tip = withQuestion({
          ...gameQuestion,
          wrongAnswers: ['Скільки час?', 'Скільки годин?', 'котра година?'],
        });

        expect(refusals(tip)).toContainEqual({
          file: 'content/tips/t_fx0001.json',
          entryId: 't_fx0001',
          field: 'gameQuestion.wrongAnswers.2',
          message: expect.stringMatching(/same answer as rightAnswer:/i) as string,
        });
      });
    });
  });

  describe('Synonym Rows', () => {
    /** A Synonym Row with every field, its dominant and one member linking a Word. */
    const fullRow = {
      id: 'r_fx0001',
      dominant: { text: 'говорити', stress: [5], wordId: 'w_fx0002' },
      meaning: 'Тестове значення: висловлювати думки словами.',
      members: [
        { text: 'балакати', stress: [3], wordId: 'w_fx0002', shadeNote: 'розмовне' },
        { text: 'мовити', stress: [1] },
        { text: 'казати', stress: [3], shadeNote: 'нейтральне' },
        { text: 'теревенити', stress: [7] },
        { text: 'гомоніти', stress: [5] },
      ],
      example: { text: 'Вони довго говорили біля хати.', author: 'Тестовий автор' },
      sources: [{ title: 'Тестове джерело', url: 'https://example.com/rows' }],
    };

    function withRows(rows: Json[]): string {
      const editionDir = copyFixture('valid');
      mkdirSync(join(editionDir, 'content/synonym-rows'), { recursive: true });
      for (const row of rows) {
        writeFileSync(
          join(editionDir, `content/synonym-rows/${String(row['id'])}.json`),
          JSON.stringify(row),
        );
      }
      record(editionDir);
      return editionDir;
    }

    async function readRows(outFile: string, ids: string[]) {
      const pack = openLanguagePack(outFile);
      try {
        return await pack.getEntries(ids);
      } finally {
        pack.close();
      }
    }

    it('builds a Synonym Row and reads it back with every field, in pack format 8', async () => {
      const editionDir = withRows([fullRow]);
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir, outFile });

      expect(result.ok ? [] : result.errors).toEqual([]);
      expect(result).toMatchObject({ ok: true, metadata: { packFormat: 8 } });
      expect(await readRows(outFile, ['r_fx0001'])).toEqual([
        { ...fullRow, kind: 'synonymRow', retired: false },
      ]);
    });

    it('reads back a Retired Synonym Row and a row of plain members without notes, example or links', async () => {
      const plainRow = {
        id: 'r_fx0002',
        dominant: { text: 'іти', stress: [0] },
        meaning: 'Тестове значення: рухатися пішки.',
        members: (
          [
            ['простувати', 7],
            ['чимчикувати', 8],
            ['шкандибати', 7],
            ['дибати', 3],
            ['сунути', 1],
          ] as const
        ).map(([text, stressed]) => ({ text, stress: [stressed] })),
        sources: [{ title: 'Тестове джерело' }],
        retired: true,
      };
      const outFile = packPath();

      buildLanguagePack({ editionDir: withRows([plainRow]), outFile });

      expect(await readRows(outFile, ['r_fx0002'])).toEqual([{ ...plainRow, kind: 'synonymRow' }]);
    });

    it('drops the link to a Retired Word, keeping the dominant or the member as plain text', async () => {
      const row = {
        ...fullRow,
        dominant: { ...fullRow.dominant, wordId: 'w_fx0001' },
        members: fullRow.members.map((member, place) =>
          place === 1 ? { ...member, wordId: 'w_fx0001' } : member,
        ),
      };
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir: withRows([row]), outFile });

      expect(result.ok ? [] : result.errors).toEqual([]);
      expect(await readRows(outFile, ['r_fx0001'])).toEqual([
        {
          ...fullRow,
          kind: 'synonymRow',
          dominant: { text: 'говорити', stress: [5] },
          retired: false,
        },
      ]);
    });

    describe('refuses a bad Synonym Row and says why', () => {
      const member = (place: number) => fullRow.members[place] as Json;
      const withMembers = (members: Json[]) => ({ ...fullRow, members });

      /** The build's refusals for the row, which is written but not recorded. */
      function refusals(row: Json) {
        const editionDir = copyFixture('valid');
        mkdirSync(join(editionDir, 'content/synonym-rows'), { recursive: true });
        writeFileSync(join(editionDir, 'content/synonym-rows/r_fx0001.json'), JSON.stringify(row));
        const result = buildLanguagePack({ editionDir, outFile: packPath() });
        return result.ok ? [] : result.errors;
      }

      it.each<[string, Json, string, RegExp]>([
        [
          'fewer than 5 members',
          withMembers(fullRow.members.slice(0, 4)),
          'members',
          /at least 5|>=5/i,
        ],
        [
          'more than 12 members',
          withMembers(
            Array.from({ length: 13 }, (_, place) => ({
              text: `слово${'а'.repeat(place)}`,
              stress: [2],
            })),
          ),
          'members',
          /at most 12|<=12/i,
        ],
        [
          'two members with the same text',
          withMembers([...fullRow.members.slice(0, 4), { text: 'мовити', stress: [3] }]),
          'members.4.text',
          /same text as members\.1:/i,
        ],
        [
          'a shade note over 60 characters',
          withMembers([{ ...member(0), shadeNote: 'н'.repeat(61) }, ...fullRow.members.slice(1)]),
          'members.0.shadeNote',
          /at most 60|<=60/i,
        ],
        ['no source', { ...fullRow, sources: [] }, 'sources', /at least 1|>=1/i],
        [
          'an unknown Word id on the dominant',
          { ...fullRow, dominant: { ...fullRow.dominant, wordId: 'w_fx9999' } },
          'dominant.wordId',
          /unknown word "w_fx9999"/i,
        ],
        [
          'an unknown Word id on a member',
          withMembers([
            member(0),
            { ...member(1), wordId: 'w_fx9999' },
            ...fullRow.members.slice(2),
          ]),
          'members.1.wordId',
          /unknown word "w_fx9999"/i,
        ],
        [
          'Stress on a letter that is not a vowel',
          { ...fullRow, dominant: { ...fullRow.dominant, stress: [0] } },
          'dominant.stress.0',
          /position 0 is "г", not a vowel/i,
        ],
        [
          'Stress out of the range of the text',
          withMembers([...fullRow.members.slice(0, 4), { ...member(4), stress: [8] }]),
          'members.4.stress.0',
          /position 8 is out of range for the 8-letter text/i,
        ],
      ])('%s', (_rule, row, field, message) => {
        expect(refusals(row)).toContainEqual({
          file: 'content/synonym-rows/r_fx0001.json',
          entryId: 'r_fx0001',
          field,
          message: expect.stringMatching(message) as string,
        });
      });

      it('compares member texts in lower case', () => {
        const row = withMembers([...fullRow.members.slice(0, 4), { text: 'Казати', stress: [3] }]);

        expect(refusals(row)).toContainEqual({
          file: 'content/synonym-rows/r_fx0001.json',
          entryId: 'r_fx0001',
          field: 'members.4.text',
          message: expect.stringMatching(/same text as members\.2:/i) as string,
        });
      });
    });

    it('lists the ids of the live Synonym Rows, leaving a Retired one out', async () => {
      const outFile = packPath();
      const retired = { ...fullRow, id: 'r_fx0002', retired: true };

      buildLanguagePack({ editionDir: withRows([fullRow, retired]), outFile });

      const pack = openLanguagePack(outFile);
      try {
        expect(await pack.listSynonymRowIds()).toEqual(['r_fx0001']);
      } finally {
        pack.close();
      }
    });

    it('keeps Synonym Rows out of the Entries the screens are given', async () => {
      const outFile = packPath();

      buildLanguagePack({ editionDir: withRows([fullRow]), outFile });

      expect(await withEntries(outFile, (entries) => entries.get('r_fx0001'))).toBeUndefined();
    });
  });

  it("allows in an expression only the Edition's expression punctuation besides a Lemma's", () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/idioms/i_fx0001.json', (idiom) => ({
      ...idiom,
      expression: 'бити байдики — ледарювати, гаяти час',
    }));
    record(editionDir);
    const result = buildLanguagePack({ editionDir, outFile: packPath() });
    expect(result.ok ? [] : result.errors).toEqual([]);

    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: { ...(config['languageTraits'] as Json), expressionPunctuation: ',' },
    }));
    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'content/idioms/i_fx0001.json',
        entryId: 'i_fx0001',
        field: 'expression',
        message: expect.stringMatching(/"—" \(U\+2014\) is not a letter/) as string,
      },
    ]);
  });

  it('builds a paronym, a Correction of Correction Type paronym, and reads it back', async () => {
    const editionDir = copyFixture('valid');
    const paronym = {
      id: 'c_fx0006',
      nonStandardForm: 'ефективна сукня',
      correctionType: 'paronym',
      standardEquivalents: ['ефектна сукня'],
      explanation: 'Тестове пояснення: ефективний дає наслідок, ефектний вражає.',
      examplePair: {
        nonStandard: 'Вона вдягла ефективну сукню.',
        standard: 'Вона вдягла ефектну сукню.',
      },
      categoryId: 'shop',
      sources: [{ title: 'Тестове джерело' }],
    };
    writeFileSync(join(editionDir, 'content/corrections/c_fx0006.json'), JSON.stringify(paronym));
    record(editionDir);
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir, outFile });

    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(await withEntries(outFile, (entries) => entries.get('c_fx0006'))).toEqual({
      ...paronym,
      kind: 'correction',
      literaryUses: [],
      retired: false,
    });
  });

  describe('literary uses of a Correction', () => {
    /**
     * A copy of the valid fixture whose Correction c_fx0001 carries the given
     * literary uses, recorded on a day they are all in the public domain.
     */
    function withLiteraryUses(literaryUses: Json[]): string {
      const editionDir = copyFixture('valid');
      editJson(editionDir, 'content/corrections/c_fx0001.json', (json) => ({
        ...json,
        literaryUses,
      }));
      record(editionDir, new Date(9999, 0, 1));
      return editionDir;
    }

    const use = (authorDeathYear: number): Json => ({
      text: 'Він завжди приходив вчасно.',
      author: 'Тестовий автор',
      work: 'Тестовий твір',
      authorDeathYear,
    });

    it('builds them and reads them back in their order, each with its author and work', async () => {
      const literaryUses = [
        { ...use(1861), workYear: 1840, url: 'https://example.org/work' },
        use(1913),
      ];
      const editionDir = withLiteraryUses(literaryUses);
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir, outFile });

      expect(result.ok ? [] : result.errors).toEqual([]);
      const correction = await withEntries(outFile, (entries) => entries.get('c_fx0001'));
      expect(correction?.kind === 'correction' && correction.literaryUses).toEqual(literaryUses);
    });

    it('refuses a text not yet in the public domain: 70 years after the author died, from the next 1 January', () => {
      const editionDir = withLiteraryUses([use(1913), use(1960)]);
      const build = (today: Date) => buildLanguagePack({ editionDir, outFile: packPath(), today });

      const refused = build(new Date(2030, 11, 31));
      expect(refused.ok ? [] : refused.errors).toEqual([
        {
          file: 'content/corrections/c_fx0001.json',
          entryId: 'c_fx0001',
          field: 'literaryUses.1.authorDeathYear',
          message: 'Not in the public domain until 1 January 2031',
        },
      ]);
      expect(checkLanguagePack({ editionDir, today: new Date(2030, 11, 31) }).ok).toBe(false);
      expect(build(new Date(2031, 0, 1)).ok).toBe(true);
    });

    it('refuses more than three on a Correction', () => {
      const editionDir = copyFixture('valid');
      editJson(editionDir, 'content/corrections/c_fx0001.json', (json) => ({
        ...json,
        literaryUses: [use(1861), use(1861), use(1861), use(1861)],
      }));

      expect(buildErrors(editionDir)).toContainEqual(
        expect.objectContaining({ entryId: 'c_fx0001', field: 'literaryUses' }),
      );
    });
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
        { correctionType: 'paronym', corrections: 0 },
      ],
      correctionsPerCategory: [
        { categoryId: 'work', displayName: 'На роботі', corrections: 3 },
        { categoryId: 'shop', displayName: 'У магазині', corrections: 1 },
      ],
      idioms: 2,
      retiredIdioms: 0,
      idiomsPerType: [
        { idiomType: 'idiom', idioms: 1 },
        { idiomType: 'placeName', idioms: 1 },
        { idiomType: 'proverb', idioms: 0 },
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
    expect(printed).toMatch(
      /Corrections per Category:\n\s+work\s+На роботі\s+3\n\s+shop\s+У магазині\s+1/,
    );
    expect(printed).toMatch(/Idioms:\s+2 \(0 Retired Idioms left out\)/);
    expect(printed).toMatch(
      /Idioms per Idiom Type:\n\s+idiom\s+1\n\s+placeName\s+1\n\s+proverb\s+0/,
    );
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

  it('builds the history of a Word and gives its Word card the history', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
      ...word,
      history: 'Слово вилучили зі словників 1933 року.',
    }));
    record(editionDir);
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir, outFile });

    if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
    await withEntries(outFile, async (entries) => {
      const word = await entries.get('w_fx0002');
      if (word?.kind !== 'word') throw new Error('No Word w_fx0002');
      expect(word.history).toBe('Слово вилучили зі словників 1933 року.');
      expect((await buildWordCard({ word, entries })).history).toBe(
        'Слово вилучили зі словників 1933 року.',
      );
    });
  });

  describe('the origin of a Word', () => {
    /** A copy of the valid fixture whose Edition also lists Latin and Greek as origin languages. */
    function withOriginLanguages(): string {
      const editionDir = copyFixture('valid');
      editJson(editionDir, 'edition.json', (config) => ({
        ...config,
        originLanguages: [
          ...(config['originLanguages'] as Json[]),
          { code: 'la', name: 'латина' },
          { code: 'grc', name: 'грецька' },
        ],
      }));
      return editionDir;
    }

    it("builds a Word with an origin from the Edition's list and reads it back, in pack format 8", async () => {
      const editionDir = withOriginLanguages();
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, origin: 'la' }));
      record(editionDir);
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir, outFile });

      if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
      expect(result.metadata.packFormat).toBe(8);
      await withEntries(outFile, async (entries) => {
        const word = await entries.get('w_fx0002');
        const other = await entries.get('w_fx0003');
        if (word?.kind !== 'word' || other?.kind !== 'word') throw new Error('No Words');
        expect(word.origin).toBe('la');
        expect(other).not.toHaveProperty('origin');
      });
    });

    it('refuses an origin code the Edition does not list', () => {
      const editionDir = withOriginLanguages();
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, origin: 'fr' }));

      expect(buildErrors(editionDir)).toEqual([
        {
          file: 'content/words/w_fx0002.json',
          entryId: 'w_fx0002',
          field: 'origin',
          message: expect.stringMatching(/unknown origin language "fr"/i) as string,
        },
      ]);
    });

    it('refuses an origin that is not a language code', () => {
      const editionDir = withOriginLanguages();
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
        ...word,
        origin: 'Латина',
      }));

      expect(buildErrors(editionDir)).toEqual([
        expect.objectContaining({ entryId: 'w_fx0002', field: 'origin' }),
      ]);
    });
  });

  describe('the moods of a Word', () => {
    /** A copy of the valid fixture whose Edition also lists a joyful mood. */
    function withMoods(): string {
      const editionDir = copyFixture('valid');
      editJson(editionDir, 'edition.json', (config) => ({
        ...config,
        moods: [...(config['moods'] as Json[]), { id: 'joyful', name: 'радісний', emoji: '😊' }],
      }));
      return editionDir;
    }

    it("builds a Word with moods from the Edition's list and reads them back in order, in pack format 8", async () => {
      const editionDir = withMoods();
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
        ...word,
        moods: ['joyful', 'calm'],
      }));
      record(editionDir);
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir, outFile });

      if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
      expect(result.metadata.packFormat).toBe(8);
      await withEntries(outFile, async (entries) => {
        const word = await entries.get('w_fx0002');
        const other = await entries.get('w_fx0003');
        if (word?.kind !== 'word' || other?.kind !== 'word') throw new Error('No Words');
        expect(word.moods).toEqual(['joyful', 'calm']);
        expect(other).not.toHaveProperty('moods');
      });
    });

    it('refuses a mood id the Edition does not list', () => {
      const editionDir = withMoods();
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
        ...word,
        moods: ['calm', 'gloomy'],
      }));

      expect(buildErrors(editionDir)).toEqual([
        {
          file: 'content/words/w_fx0002.json',
          entryId: 'w_fx0002',
          field: 'moods',
          message: expect.stringMatching(/unknown mood "gloomy"/i) as string,
        },
      ]);
    });

    it.each([
      ['a repeated mood', ['calm', 'calm']],
      ['an empty list of moods', []],
    ])('refuses %s', (_, moods) => {
      const editionDir = withMoods();
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, moods }));

      expect(buildErrors(editionDir)).toEqual([
        expect.objectContaining({ entryId: 'w_fx0002', field: 'moods' }),
      ]);
    });
  });

  describe('the Illustration of a Word', () => {
    function pngChunk(type: string, data: Buffer): Buffer {
      const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([length, body, crc]);
    }

    /** A blank greyscale PNG, padded with a comment to `bytes` when given. */
    function png(width: number, height: number, bytes?: number): Buffer {
      const header = Buffer.alloc(13);
      header.writeUInt32BE(width, 0);
      header.writeUInt32BE(height, 4);
      header.writeUInt8(8, 8);
      const rows = Buffer.alloc((width + 1) * height);
      const parts = [
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', header),
        pngChunk('IDAT', deflateSync(rows)),
        pngChunk('IEND', Buffer.alloc(0)),
      ];
      if (bytes === undefined) return Buffer.concat(parts);
      const keyword = Buffer.from('Comment\0', 'latin1');
      const padding = bytes - Buffer.concat(parts).length - 12 - keyword.length;
      const comment = pngChunk('tEXt', Buffer.concat([keyword, Buffer.alloc(padding, 'x')]));
      return Buffer.concat([...parts.slice(0, -1), comment, parts.at(-1) ?? Buffer.alloc(0)]);
    }

    /** A copy of the valid fixture whose Word w_fx0002 names `name`, with `file` in its illustrations. */
    function withIllustration(name: string, file?: Buffer): string {
      const editionDir = copyFixture('valid');
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({
        ...word,
        illustration: name,
      }));
      if (file !== undefined) {
        mkdirSync(join(editionDir, 'assets/illustrations'), { recursive: true });
        writeFileSync(join(editionDir, 'assets/illustrations', name), file);
      }
      return editionDir;
    }

    const refusal = (message: string): BuildError => ({
      file: 'content/words/w_fx0002.json',
      entryId: 'w_fx0002',
      field: 'illustration',
      message,
    });

    it('builds a Word that names an Illustration and reads the name back, in pack format 8', async () => {
      const editionDir = withIllustration('w_fx0002.png', png(320, 320));
      record(editionDir);
      const outFile = packPath();

      const result = buildLanguagePack({ editionDir, outFile });

      if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
      expect(result.metadata.packFormat).toBe(8);
      await withEntries(outFile, async (entries) => {
        const word = await entries.get('w_fx0002');
        const other = await entries.get('w_fx0003');
        if (word?.kind !== 'word' || other?.kind !== 'word') throw new Error('No Words');
        expect(word.illustration).toBe('w_fx0002.png');
        expect(other).not.toHaveProperty('illustration');
      });
    });

    it('builds an Illustration of exactly 150 KB', () => {
      const editionDir = withIllustration('w_fx0002.png', png(320, 320, 150_000));
      record(editionDir);

      const result = buildLanguagePack({ editionDir, outFile: packPath() });

      expect(result.ok ? [] : result.errors).toEqual([]);
    });

    it('refuses an Illustration whose file is missing', () => {
      const editionDir = withIllustration('w_fx0002.png');

      expect(buildErrors(editionDir)).toEqual([
        refusal('No file w_fx0002.png in assets/illustrations/'),
      ]);
    });

    it('refuses an Illustration whose name is a folder, not a file', () => {
      const editionDir = withIllustration('w_fx0002.png');
      mkdirSync(join(editionDir, 'assets/illustrations/w_fx0002.png'), { recursive: true });

      expect(buildErrors(editionDir)).toEqual([
        refusal('No file w_fx0002.png in assets/illustrations/'),
      ]);
    });

    it.each([
      ['a JPEG named .png', 'w_fx0002.png', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])],
      ['a PNG not named .png', 'w_fx0002.jpg', png(320, 320)],
    ])('refuses an Illustration that is %s as not a PNG', (_, name, file) => {
      const editionDir = withIllustration(name, file);

      expect(buildErrors(editionDir)).toEqual([
        refusal(`assets/illustrations/${name} is not a PNG`),
      ]);
    });

    it('refuses an Illustration over 150 KB', () => {
      const editionDir = withIllustration('w_fx0002.png', png(320, 320, 150_001));

      expect(buildErrors(editionDir)).toEqual([
        refusal(
          'assets/illustrations/w_fx0002.png is 150001 bytes, over the 150 KB (150000 bytes) limit',
        ),
      ]);
    });

    it('refuses an Illustration that is not square', () => {
      const editionDir = withIllustration('w_fx0002.png', png(320, 200));

      expect(buildErrors(editionDir)).toEqual([
        refusal('assets/illustrations/w_fx0002.png is 320×200 px, not square'),
      ]);
    });

    it('refuses an Illustration with every reason that applies', () => {
      const editionDir = withIllustration('w_fx0002.png', png(320, 200, 150_001));

      expect(buildErrors(editionDir)).toEqual([
        refusal(
          'assets/illustrations/w_fx0002.png is 150001 bytes, over the 150 KB (150000 bytes) limit',
        ),
        refusal('assets/illustrations/w_fx0002.png is 320×200 px, not square'),
      ]);
    });

    it('refuses the same broken Illustration in checkLanguagePack', () => {
      const editionDir = withIllustration('w_fx0002.png', png(320, 200));

      expect(checkLanguagePack({ editionDir })).toEqual({
        ok: false,
        errors: [refusal('assets/illustrations/w_fx0002.png is 320×200 px, not square')],
      });
    });

    it.each([
      ['a path', 'birds/w_fx0002.png'],
      ['a hidden file', '.w_fx0002.png'],
      ['an empty name', ''],
    ])('refuses an illustration that is %s, not a file name', (_, illustration) => {
      const editionDir = copyFixture('valid');
      editJson(editionDir, 'content/words/w_fx0002.json', (word) => ({ ...word, illustration }));

      expect(buildErrors(editionDir)).toEqual([
        expect.objectContaining({ entryId: 'w_fx0002', field: 'illustration' }),
      ]);
    });
  });

  it('refuses a Word without history in a Category that requires it, and builds one with it', () => {
    const editionDir = copyFixture('valid');
    const requireHistoryOf = (categoryId: string) => {
      editJson(editionDir, 'edition.json', (config) => ({
        ...config,
        categoriesRequiringHistory: [categoryId],
      }));
    };

    // The only Word in "nature" carries its history.
    requireHistoryOf('nature');
    expect(buildLanguagePack({ editionDir, outFile: packPath() }).ok).toBe(true);

    requireHistoryOf('speech');
    expect(buildErrors(editionDir)).toEqual(
      ['w_fx0002', 'w_fx0003'].map((entryId) => ({
        file: `content/words/${entryId}.json`,
        entryId,
        field: 'history',
        message: expect.stringMatching(/category "speech" requires history/i) as string,
      })),
    );
  });

  it('refuses an unknown Category among the Categories that require history', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      categoriesRequiringHistory: ['work'],
    }));

    expect(buildErrors(editionDir)).toEqual([
      {
        file: 'edition.json',
        field: 'categoriesRequiringHistory.0',
        message: expect.stringMatching(/unknown category id "work"/i) as string,
      },
    ]);
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
      contentVersion: 7,
      contentChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
      packFormat: 8,
    });
    expect(b.metadata).toEqual(a.metadata);
    expect(readFileSync(second).equals(readFileSync(first))).toBe(true);
  });

  it('records the pack format in the pack and reports it from the build', async () => {
    const outFile = packPath();

    const result = buildLanguagePack({ editionDir: fixture('valid'), outFile });

    expect(result).toMatchObject({ ok: true, metadata: { packFormat: 8 } });
    expect((await readBack(outFile)).metadata.packFormat).toBe(8);
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
            /content changed since content version 7.*pnpm build:pack fixture --record/i,
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
      contentVersion: 7,
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

describe('the Word of the Day font', () => {
  const letters = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  const stressMark = '\u0301';
  const everyCharacter = `${letters}${letters.toLocaleUpperCase('uk')}${stressMark}`;

  /** A copy of the valid fixture whose Word of the Day font is the given file. */
  function withFont(name: string, font?: Buffer): string {
    const editionDir = copyFixture('valid');
    if (font !== undefined) writeFileSync(join(editionDir, 'assets/fonts', name), font);
    editJson(editionDir, 'edition.json', (config) => ({ ...config, wordOfTheDayFont: name }));
    return editionDir;
  }

  const errorsOf = (editionDir: string) => {
    const result = checkLanguagePack({ editionDir });
    return result.ok ? [] : result.errors;
  };

  it('passes a font with every letter of the alphabet, in both cases, and the Stress mark', () => {
    expect(errorsOf(withFont('Script.ttf', fontWith(everyCharacter)))).toEqual([]);
  });

  it('refuses a font file the Edition does not bring', () => {
    expect(errorsOf(withFont('Missing.ttf'))).toEqual([
      {
        file: 'edition.json',
        field: 'wordOfTheDayFont',
        message: 'No font file Missing.ttf in assets/fonts/',
      },
    ]);
  });

  it('refuses a file that is not a font', () => {
    expect(errorsOf(withFont('Script.ttf', Buffer.from('not a font')))).toEqual([
      {
        file: 'edition.json',
        field: 'wordOfTheDayFont',
        message: 'assets/fonts/Script.ttf is not a TrueType or OpenType font',
      },
    ]);
  });

  it('refuses a font without «ї», naming the missing letter', () => {
    const font = fontWith(everyCharacter.replace('ї', ''));

    expect(errorsOf(withFont('Script.ttf', font))).toEqual([
      {
        file: 'edition.json',
        field: 'wordOfTheDayFont',
        message: 'assets/fonts/Script.ttf has no glyph for ї',
      },
    ]);
  });

  it('refuses a font without capital letters, naming each', () => {
    const font = fontWith(`${letters}${stressMark}Ґ`);

    expect(errorsOf(withFont('Script.ttf', font))).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/ has no glyph for А, Б, В, Г, Д, Е, .*, Ю, Я$/) as unknown,
      }),
    ]);
  });

  it('refuses a font without the Stress mark, naming it', () => {
    const font = fontWith(everyCharacter.replace(stressMark, ''));

    expect(errorsOf(withFont('Script.ttf', font))).toEqual([
      {
        file: 'edition.json',
        field: 'wordOfTheDayFont',
        message: 'assets/fonts/Script.ttf has no glyph for the Stress mark (U+0301)',
      },
    ]);
  });

  it('asks no Stress mark of an Edition that does not mark Stress', () => {
    const editionDir = withFont('Script.ttf', fontWith(everyCharacter.replace(stressMark, '')));
    editJson(editionDir, 'edition.json', (config) => ({
      ...config,
      languageTraits: { ...(config['languageTraits'] as Json), marksStress: false },
    }));

    expect(errorsOf(editionDir).filter(({ file }) => file === 'edition.json')).toEqual([]);
  });

  it('reads the character map of a real font: Manrope has Cyrillic but no Stress mark', () => {
    const manrope = readFileSync(
      fileURLToPath(
        new URL('../../../editions/uk/assets/fonts/Manrope-Regular.ttf', import.meta.url),
      ),
    );

    expect(errorsOf(withFont('Manrope-Regular.ttf', manrope))).toEqual([
      {
        file: 'edition.json',
        field: 'wordOfTheDayFont',
        message: 'assets/fonts/Manrope-Regular.ttf has no glyph for the Stress mark (U+0301)',
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
      previousContentVersion: 7,
      contentVersion: 7,
      contentChecksum: manifestOf(editionDir)['contentChecksum'],
      newIds: [],
      newCrosswordDays: [],
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

    expect(recorded).toMatchObject({ ok: true, previousContentVersion: 7, contentVersion: 8 });
    expect(result.ok).toBe(true);
    const { metadata } = await readBack(edited);
    expect(metadata).toMatchObject({ contentVersion: 8 });
    expect(manifestOf(editionDir)).toEqual({
      contentVersion: 8,
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
    expect(manifestOf(editionDir)).toMatchObject({ contentVersion: 7 });
  });

  it('records nothing while a literary use is not yet in the public domain, as the build refuses it', () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/corrections/c_fx0001.json', (json) => ({
      ...json,
      literaryUses: [
        {
          text: 'Він завжди приходив вчасно.',
          author: 'Тестовий автор',
          work: 'Тестовий твір',
          authorDeathYear: 1960,
        },
      ],
    }));
    const manifest = readFileSync(join(editionDir, 'content/manifest.json'), 'utf8');

    expect(recordContent({ editionDir, today: new Date(2030, 11, 31) })).toEqual({
      ok: false,
      errors: [
        {
          file: 'content/corrections/c_fx0001.json',
          entryId: 'c_fx0001',
          field: 'literaryUses.0.authorDeathYear',
          message: 'Not in the public domain until 1 January 2031',
        },
      ],
    });
    expect(readFileSync(join(editionDir, 'content/manifest.json'), 'utf8')).toBe(manifest);
    expect(recordContent({ editionDir, today: new Date(2031, 0, 1) })).toMatchObject({ ok: true });
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

  it('misses the per-Category target of Corrections, naming every Category that falls short', () => {
    const editionDir = editionWithTargets({ minCorrectionsPerCategory: 2 });

    expect(missedTargets(editionDir)).toEqual([
      {
        target: 'minCorrectionsPerCategory',
        message: 'Category "shop" has 1 Corrections, below the target of 2',
      },
    ]);
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
