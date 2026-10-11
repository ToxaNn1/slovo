import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { CorrectionSchema, WordSchema } from '@slovo/contracts';
import { createContent, systemRandom } from '@slovo/core';

import {
  buildLanguagePack,
  formatBuildError,
  formatContentReport,
  openLanguagePack,
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

const validWordFiles = ['w_fx0001', 'w_fx0002', 'w_fx0003'].map((id) => `content/words/${id}.json`);

async function readBack(outFile: string) {
  const pack = openLanguagePack(outFile);
  try {
    return { metadata: await pack.metadata(), ids: await pack.listWordIds() };
  } finally {
    pack.close();
  }
}

async function withContent<T>(
  outFile: string,
  use: (content: ReturnType<typeof createContent>) => Promise<T>,
): Promise<T> {
  const pack = openLanguagePack(outFile);
  try {
    return await use(createContent({ port: pack, random: systemRandom }));
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

    it('reports nothing but those errors', () => {
      expect(errors()).toHaveLength(18);
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
        message: expect.stringMatching(/duplicate.*c_fx0002\.json/i) as string,
      },
    ]);
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
      coverage: { examples: 1, synonyms: 1, etymology: 0 },
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
    expect(printed).toMatch(/Corrections:\s+4/);
    expect(printed).toMatch(/russianism\s+2/);
    expect(printed).toMatch(/calque\s+0/);
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

  it('changes the checksum when the content changes', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/words/w_fx0001.json', (word) => ({
      ...word,
      primaryDefinition: 'Інше значення.',
    }));
    const original = packPath();
    const edited = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile: original });
    buildLanguagePack({ editionDir, outFile: edited });

    const a = await readBack(original);
    const b = await readBack(edited);
    expect(b.metadata.checksum).not.toBe(a.metadata.checksum);
  });

  it('changes the checksum when a Correction changes', async () => {
    const editionDir = copyFixture('valid');
    editJson(editionDir, 'content/corrections/c_fx0004.json', (correction) => ({
      ...correction,
      standardEquivalents: ['нині', 'сьогодні'],
    }));
    const original = packPath();
    const edited = packPath();

    buildLanguagePack({ editionDir: fixture('valid'), outFile: original });
    buildLanguagePack({ editionDir, outFile: edited });

    const a = await readBack(original);
    const b = await readBack(edited);
    expect(b.metadata.checksum).not.toBe(a.metadata.checksum);
  });
});
