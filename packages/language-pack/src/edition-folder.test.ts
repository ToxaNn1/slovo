import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CorrectionSchema,
  IdiomSchema,
  SynonymRowSchema,
  WordSchema,
  type Correction,
  type Idiom,
  type SynonymRow,
  type Word,
} from '@slovo/contracts';
import type { ContentSnapshot } from '@slovo/contracts/api';

import {
  EditionFolderError,
  listEditions,
  openEditionWithoutRecords,
  openEditionWithSnapshot,
  snapshotEntries,
} from './edition-folder';
import { fixtureDir, validSnapshot } from './test-support';

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Json = Record<string, unknown>;

/**
 * A throwaway editions folder holding a copy of the fixture Edition (id
 * `fixture`) in the given folder, changed by `change`.
 */
function editionsWith({
  folder = 'fixture',
  change = () => undefined,
}: {
  folder?: string;
  change?: (editionDir: string) => void;
} = {}): string {
  const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  workDirs.push(editionsDir);
  const editionDir = join(editionsDir, folder);
  cpSync(fixtureDir('valid'), editionDir, { recursive: true });
  change(editionDir);
  return editionsDir;
}

function editJson(path: string, edit: (json: Json) => Json): void {
  writeFileSync(path, JSON.stringify(edit(JSON.parse(readFileSync(path, 'utf8')) as Json)));
}

/** The fixture Edition of an editions folder, with the given records, the fixture's own by default. */
function openFixture(editionsDir: string, snapshot: ContentSnapshot = validSnapshot()) {
  return openEditionWithSnapshot(editionsDir, 'fixture', snapshot);
}

/** The fixture's snapshot with each Word changed by `change`. */
function withWords(
  change: (word: ContentSnapshot['words'][number]) => ContentSnapshot['words'][number],
) {
  const snapshot = validSnapshot();
  return { ...snapshot, words: snapshot.words.map(change) };
}

/** One of the fixture's records, as the Edition reads it. */
function fixtureEntry<E extends { readonly id: string }>(
  entries: readonly { readonly entry: E }[],
  id: string,
): E {
  const found = entries.find(({ entry }) => entry.id === id);
  if (found === undefined) throw new Error(`The fixture has no ${id}`);
  return found.entry;
}

const fixtureWord = (id: string) => fixtureEntry(snapshotEntries(validSnapshot()).words, id);
const fixtureCorrection = (id: string) =>
  fixtureEntry(snapshotEntries(validSnapshot()).corrections, id);

/** The failure of opening or reading, or undefined when nothing failed. */
function failureOf(open: () => unknown): EditionFolderError | undefined {
  try {
    open();
    return undefined;
  } catch (error) {
    if (error instanceof EditionFolderError) return error;
    throw error;
  }
}

describe('listEditions', () => {
  it('lists every folder that holds an Edition config, in code-unit order', () => {
    const editionsDir = editionsWith({ folder: 'uk' });
    cpSync(join(editionsDir, 'uk'), join(editionsDir, 'pl'), { recursive: true });
    mkdirSync(join(editionsDir, 'drafts'));
    writeFileSync(join(editionsDir, 'README.md'), '');

    expect(listEditions(editionsDir)).toEqual(['pl', 'uk']);
  });

  it('lists nothing in a folder without Editions', () => {
    const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
    workDirs.push(editionsDir);

    expect(listEditions(editionsDir)).toEqual([]);
  });
});

describe('openEditionWithSnapshot', () => {
  it('opens an Edition by its id with its config checked and the records of the snapshot', () => {
    const editionsDir = editionsWith();

    const edition = openFixture(editionsDir);

    expect(edition.id).toBe('fixture');
    expect(edition.dir).toBe(join(editionsDir, 'fixture'));
    expect(edition.entries().words.map(({ file }) => file)).toEqual([
      'snapshot:word/w_fx0001',
      'snapshot:word/w_fx0002',
      'snapshot:word/w_fx0003',
    ]);
  });

  it('refuses a snapshot of another Edition', () => {
    const editionsDir = editionsWith();

    const failure = failureOf(() =>
      openFixture(editionsDir, { ...validSnapshot(), editionId: 'pl' }),
    );

    expect(failure).toMatchObject({
      reason: 'invalid',
      errors: [{ file: 'snapshot', message: 'The snapshot is of Edition pl, not fixture' }],
    });
  });

  it('opens an Edition without records for its config and files alone', () => {
    const edition = openEditionWithoutRecords(editionsWith(), 'fixture');

    expect(edition.config.id).toBe('fixture');
    expect(edition.entries().words).toEqual([]);
  });

  it('refuses an unknown Edition and names the known ones', () => {
    const editionsDir = editionsWith();

    const failure = failureOf(() => openEditionWithoutRecords(editionsDir, 'xx'));

    expect(failure).toMatchObject({ reason: 'unknown', editionId: 'xx', errors: [] });
    expect(failure?.message).toMatch(/Unknown Edition "xx".*Known Editions: fixture/s);
  });

  it.each(['../fixture', 'fixture/', '', 'fixture/assets'])(
    'refuses "%s", which is not the folder of an Edition',
    (editionId) => {
      const editionsDir = editionsWith();

      expect(failureOf(() => openEditionWithoutRecords(editionsDir, editionId))?.reason).toBe(
        'unknown',
      );
    },
  );

  it('refuses an Edition whose id differs from its folder name', () => {
    const editionsDir = editionsWith({ folder: 'uk' });

    const failure = failureOf(() => openEditionWithoutRecords(editionsDir, 'uk'));

    expect(failure).toMatchObject({
      reason: 'invalid',
      editionId: 'uk',
      errors: [
        {
          file: 'edition.json',
          field: 'id',
          message: expect.stringMatching(/id "fixture".*folder "uk"/) as string,
        },
      ],
    });
  });

  // ADR 0089: the Edition declares each feature on, off or unavailable.
  it('reads the three states of a Feature Switch', () => {
    const editionsDir = editionsWith({
      change: (dir) => {
        editJson(join(dir, 'edition.json'), (config) => ({
          ...config,
          featureSwitches: {
            ...(config['featureSwitches'] as Json),
            game: 'off',
            narratorVoice: 'unavailable',
          },
        }));
      },
    });

    expect(openFixture(editionsDir).config.featureSwitches).toMatchObject({
      game: 'off',
      narratorVoice: 'unavailable',
      corrections: 'on',
    });
  });

  it('refuses a Feature Switch it does not know, and a boolean, the shape before ADR 0089', () => {
    const editionsDir = editionsWith({
      change: (dir) => {
        editJson(join(dir, 'edition.json'), (config) => ({
          ...config,
          featureSwitches: { ...(config['featureSwitches'] as Json), teleport: 'on', game: true },
        }));
      },
    });

    const failure = failureOf(() => openFixture(editionsDir));

    expect(failure?.reason).toBe('invalid');
    expect(failure?.errors.map(({ field }) => field)).toEqual([
      'featureSwitches.game',
      'featureSwitches.teleport',
    ]);
  });

  it('names every field of an invalid config', () => {
    const editionsDir = editionsWith({
      change: (dir) => {
        editJson(join(dir, 'edition.json'), ({ locale: _locale, ...config }) => ({
          ...config,
          featureSwitches: 'all',
          extra: true,
        }));
      },
    });

    const failure = failureOf(() => openFixture(editionsDir));

    expect(failure?.reason).toBe('invalid');
    expect(failure?.errors.map(({ file, field }) => `${file} › ${field ?? ''}`)).toEqual([
      'edition.json › locale',
      'edition.json › featureSwitches',
      'edition.json › extra',
    ]);
    expect(failure?.message).toMatch(/fixture.*edition\.json › locale/s);
  });

  it('reports a config that is not JSON', () => {
    const editionsDir = editionsWith({
      change: (dir) => {
        writeFileSync(join(dir, 'edition.json'), '{ "id": ');
      },
    });

    expect(failureOf(() => openFixture(editionsDir))?.errors).toEqual([
      expect.objectContaining({
        file: 'edition.json',
        message: expect.stringMatching(/^Invalid JSON/) as string,
      }),
    ]);
  });
});

describe('an Edition folder', () => {
  it('reads a file against its contract', () => {
    const edition = openFixture(editionsWith());

    expect(edition.read('config').categories.map(({ id }) => id)).toEqual(['nature', 'speech']);
  });

  it('reports a missing file it needs', () => {
    const edition = openFixture(editionsWith());

    expect(failureOf(() => edition.read('strings'))).toMatchObject({
      reason: 'invalid',
      errors: [{ file: 'strings.json', message: 'File not found' }],
    });
  });

  it('reads a missing optional file as absent', () => {
    const edition = openFixture(editionsWith());

    expect(edition.readIfPresent('tokens')).toBeUndefined();
    expect(edition.readIfPresent('decor')).toBeUndefined();
  });

  it('knows where its files, assets and built pack lie', () => {
    const edition = openFixture(editionsWith());

    expect(edition.path('config')).toBe(join(edition.dir, 'edition.json'));
    expect(edition.path('languagePack')).toBe(join(edition.dir, 'dist/language-pack.db'));
    expect(edition.asset('notification.wav')).toBe(join(edition.dir, 'assets/notification.wav'));
  });

  it('lists the font files it brings, in code-unit order', () => {
    const edition = openFixture(
      editionsWith({
        change: (dir) => {
          mkdirSync(join(dir, 'assets/fonts'), { recursive: true });
          for (const file of ['Serif.ttf', 'Sans.otf', 'README.md']) {
            writeFileSync(join(dir, 'assets/fonts', file), '');
          }
        },
      }),
    );

    expect(edition.fonts()).toEqual(
      ['Fixture-Script.ttf', 'Sans.otf', 'Serif.ttf'].map((file) =>
        join(edition.dir, 'assets/fonts', file),
      ),
    );
  });

  it('brings no fonts when it has no font folder', () => {
    const editionsDir = editionsWith({
      change: (dir) => {
        rmSync(join(dir, 'assets/fonts'), { recursive: true });
      },
    });

    expect(openFixture(editionsDir).fonts()).toEqual([]);
  });

  it('lists the legal pages it brings, its Markdown files, in code-unit order', () => {
    const edition = openFixture(
      editionsWith({
        change: (dir) => {
          mkdirSync(join(dir, 'legal'), { recursive: true });
          for (const file of ['terms.md', 'privacy.md', 'notes.txt']) {
            writeFileSync(join(dir, 'legal', file), '');
          }
        },
      }),
    );

    expect(edition.legalPages()).toEqual(
      ['privacy.md', 'terms.md'].map((file) => join(edition.dir, 'legal', file)),
    );
  });

  it('brings no legal pages when it has no legal folder', () => {
    expect(openFixture(editionsWith()).legalPages()).toEqual([]);
  });
});

describe('checkNewWords', () => {
  const draft = (changes: Json = {}): Word =>
    WordSchema.parse({
      ...fixtureWord('w_fx0002'),
      id: 'w_draft1',
      lemma: 'снігур',
      stress: [4],
      primaryDefinition: 'Лісовий птах із червоними грудьми.',
      correctionIds: [],
      ...changes,
    });
  const draftFile = 'draft:w_draft1';

  it('accepts a draft the build would accept', () => {
    expect(openFixture(editionsWith()).checkNewWords([draft()])).toEqual([]);
  });

  it.each([
    ['a Lemma letter outside the alphabet', { lemma: 'cнігур' }, 'lemma', /"c" \(U\+0063\)/],
    ['an unknown Category', { categoryId: 'nowhere' }, 'categoryId', /unknown category.*nowhere/i],
    [
      'a Stress position out of range',
      { stress: [9] },
      'stress.0',
      /position 9 is out of range for the 6-letter lemma/i,
    ],
    ['a Stress on a consonant', { stress: [1] }, 'stress.0', /position 1 is "н", not a vowel/i],
    [
      'a Correction link to nothing',
      { correctionIds: ['c_nowhere'] },
      'correctionIds.0',
      /unknown/i,
    ],
  ])('reports %s as the build does', (_name, changes, field, message) => {
    expect(openFixture(editionsWith()).checkNewWords([draft(changes)])).toEqual([
      expect.objectContaining({
        file: draftFile,
        entryId: 'w_draft1',
        field,
        message: expect.stringMatching(message) as string,
      }),
    ]);
  });

  it('reports a draft with the Lemma and primary Definition of an existing Word', () => {
    const edition = openFixture(editionsWith());
    const existing = fixtureWord('w_fx0002');

    const errors = edition.checkNewWords([
      draft({
        lemma: existing.lemma,
        stress: existing.stress,
        primaryDefinition: existing.primaryDefinition,
      }),
    ]);

    expect(errors).toEqual([
      expect.objectContaining({
        file: draftFile,
        entryId: 'w_draft1',
        field: 'primaryDefinition',
        message: expect.stringMatching(/same lemma and primary definition as w_fx0002/i) as string,
      }),
    ]);
  });

  it('reports Stress in an Edition that does not mark Stress', () => {
    const edition = openFixture(
      editionsWith({
        change: (dir) => {
          editJson(join(dir, 'edition.json'), (config) => ({
            ...config,
            languageTraits: { ...(config['languageTraits'] as Json), stress: { marked: false } },
          }));
        },
      }),
    );

    expect(edition.checkNewWords([draft()])).toEqual([
      expect.objectContaining({
        file: draftFile,
        entryId: 'w_draft1',
        field: 'stress',
        message: 'Not allowed: the Edition does not mark Stress',
      }),
    ]);
  });

  it('leaves out the errors of the existing content', () => {
    const edition = openFixture(
      editionsWith(),
      withWords((word) => (word.id === 'w_fx0002' ? { ...word, categoryId: 'x' } : word)),
    );

    expect(edition.checkNewWords([draft()])).toEqual([]);
  });
});

describe('checkNewCorrections', () => {
  const draft = (changes: Json = {}): Correction =>
    CorrectionSchema.parse({
      ...fixtureCorrection('c_fx0001'),
      id: 'c_draft1',
      nonStandardForm: 'тимбільше',
      standardEquivalents: ['тим паче'],
      ...changes,
    });

  it('accepts a draft the build would accept', () => {
    expect(openFixture(editionsWith()).checkNewCorrections([draft()])).toEqual([]);
  });

  it.each([
    ['an unknown Category', { categoryId: 'nowhere' }, 'categoryId', /unknown category.*nowhere/i],
    [
      'a Stress mark in a Correction that is not about Stress',
      { standardEquivalents: ['тим па́че'] },
      'standardEquivalents.0',
      /only a wrong-stress Correction/i,
    ],
  ])("reports %s as the build does, under the draft's id", (_name, changes, field, message) => {
    expect(openFixture(editionsWith()).checkNewCorrections([draft(changes)])).toEqual([
      expect.objectContaining({
        file: 'draft:c_draft1',
        entryId: 'c_draft1',
        field,
        message: expect.stringMatching(message) as string,
      }),
    ]);
  });
  it('judges the public domain on the given day', () => {
    const late = draft({
      literaryUses: [
        {
          text: 'Тим паче він прийшов.',
          author: 'Тестовий автор',
          work: 'Тестовий твір',
          authorDeathYear: 2000,
        },
      ],
    });
    const edition = openFixture(editionsWith());

    expect(edition.checkNewCorrections([late], new Date(2080, 0, 1))).toEqual([]);
    expect(edition.checkNewCorrections([late], new Date(2030, 0, 1))).toEqual([
      expect.objectContaining({ field: 'literaryUses.0.authorDeathYear' }),
    ]);
  });
});

describe('checkNewSynonymRows', () => {
  const member = (text: string, stress: number[]) => ({ text, stress });
  const row = (changes: Json = {}): SynonymRow =>
    SynonymRowSchema.parse({
      id: 'r_draft1',
      dominant: { text: 'балакучий', stress: [5], wordId: 'w_fx0002' },
      meaning: 'Який любить багато говорити.',
      members: [
        member('говіркий', [3]),
        member('язикатий', [4]),
        member('багатослівний', [8]),
        member('словоохочий', [7]),
        member('гомінкий', [6]),
      ],
      sources: [{ title: 'Тестове джерело' }],
      ...changes,
    });

  it('accepts a row the build would accept', () => {
    expect(openFixture(editionsWith()).checkNewSynonymRows([row()])).toEqual([]);
  });

  it('reports a link to a Word the Edition does not have, as the build does', () => {
    const errors = openFixture(editionsWith()).checkNewSynonymRows([
      row({ dominant: { text: 'балакучий', stress: [5], wordId: 'w_nowhere' } }),
    ]);

    expect(errors).toEqual([
      expect.objectContaining({
        file: 'draft:r_draft1',
        entryId: 'r_draft1',
        field: 'dominant.wordId',
        message: 'Unknown Word "w_nowhere"',
      }),
    ]);
  });
});

describe('entryTexts', () => {
  const member = (text: string) => ({ text, stress: [1] });

  it('lists the text of every Entry of the five kinds, with its group and forms and each Word with its primary Definition, Retired ones marked', () => {
    const snapshot = validSnapshot();
    const records: ContentSnapshot = {
      ...snapshot,
      synonymRows: [
        {
          kind: 'synonymRow',
          id: 'r_fx0001',
          dominant: { text: 'тихо', stress: [1] },
          meaning: 'Без розмов, мовчки.',
          members: ['глухо', 'мовчки', 'неголосно', 'негучно', 'слабко'].map(member),
          sources: [{ title: 'Тестове джерело' }],
          retired: true,
        },
      ],
      tips: [
        {
          kind: 'tip',
          id: 't_fx0001',
          title: 'Два студенти',
          nonStandardForm: 'два студента',
          standardForm: 'два студенти',
          explanation: 'Після «два» іменник стоїть у називному відмінку множини.',
          example: { text: 'У групі лише три студенти.' },
          sources: [{ title: 'Тестове джерело' }],
          gameQuestion: {
            prompt: 'Як правильно?',
            rightAnswer: 'три олівці',
            wrongAnswers: ['три олівця', 'три олівців', 'три олівцями'],
          },
          retired: false,
        },
      ],
    };

    const texts = openFixture(editionsWith(), records).entryTexts();

    expect(texts).toEqual([
      {
        kind: 'word',
        id: 'w_fx0001',
        group: 'nature',
        text: 'заметіль',
        forms: [],
        retired: true,
        primaryDefinition: 'Сильний вітер зі снігом.',
      },
      {
        kind: 'word',
        id: 'w_fx0002',
        group: 'speech',
        text: 'балакучий',
        forms: [],
        retired: false,
        primaryDefinition: 'Який любить багато говорити.',
      },
      {
        kind: 'word',
        id: 'w_fx0003',
        group: 'speech',
        text: 'завжди',
        forms: [],
        retired: false,
        primaryDefinition: 'У будь-який час, постійно.',
      },
      {
        kind: 'correction',
        id: 'c_fx0001',
        group: 'surzhyk',
        text: 'всігда',
        forms: ['завжди'],
        retired: false,
      },
      {
        kind: 'correction',
        id: 'c_fx0002',
        group: 'russianism',
        text: 'разговорчивий',
        forms: ['балакучий', 'говіркий'],
        retired: false,
      },
      {
        kind: 'correction',
        id: 'c_fx0003',
        group: 'russianism',
        text: 'метель',
        forms: ['заметіль', 'хуртовина'],
        retired: false,
      },
      {
        kind: 'correction',
        id: 'c_fx0004',
        group: 'officialese',
        text: 'на сьогоднішній день',
        forms: ['сьогодні', 'нині'],
        retired: false,
      },
      {
        kind: 'idiom',
        id: 'i_fx0001',
        group: 'idiom',
        text: 'бити байдики',
        forms: [],
        retired: false,
      },
      {
        kind: 'idiom',
        id: 'i_fx0002',
        group: 'placeName',
        text: 'Бердичів',
        forms: [],
        retired: false,
      },
      {
        kind: 'synonymRow',
        id: 'r_fx0001',
        group: undefined,
        text: 'тихо',
        forms: ['глухо', 'мовчки', 'неголосно', 'негучно', 'слабко'],
        retired: true,
      },
      {
        kind: 'tip',
        id: 't_fx0001',
        group: undefined,
        text: 'Два студенти',
        forms: ['два студента', 'два студенти'],
        retired: false,
      },
    ]);
  });
});

describe('checkNewIdioms', () => {
  const draft = (changes: Json = {}): Idiom =>
    IdiomSchema.parse({
      id: 'i_draft1',
      expression: 'кури не клює',
      idiomType: 'idiom',
      primaryDefinition: 'Тестове значення: має багато грошей.',
      sources: [{ title: 'Тестове джерело', url: 'https://example.org/kury' }],
      ...changes,
    });
  const draftFile = 'draft:i_draft1';

  it('accepts a draft the build would accept', () => {
    expect(openFixture(editionsWith()).checkNewIdioms([draft()])).toEqual([]);
  });

  it.each([
    ['a letter outside the alphabet', { expression: 'кури нe клює' }, /"e" \(U\+0065\)/],
    [
      'the expression of an existing Idiom',
      { expression: 'Бити байдики' },
      /same expression as i_fx0001/i,
    ],
  ])('reports %s as the build does', (_name, changes, message) => {
    expect(openFixture(editionsWith()).checkNewIdioms([draft(changes)])).toEqual([
      expect.objectContaining({
        file: draftFile,
        entryId: 'i_draft1',
        field: 'expression',
        message: expect.stringMatching(message) as string,
      }),
    ]);
  });

  it('leaves out the errors of the existing content', () => {
    const snapshot = validSnapshot();
    const edition = openFixture(editionsWith(), {
      ...snapshot,
      idioms: snapshot.idioms.map((idiom) =>
        idiom.id === 'i_fx0001' ? { ...idiom, expression: 'бити bайдики' } : idiom,
      ),
    });

    expect(edition.checkNewIdioms([draft()])).toEqual([]);
  });
});
