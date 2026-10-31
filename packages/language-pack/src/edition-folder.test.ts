import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { WordSchema, type Word } from '@slovo/contracts';

import { EditionFolderError, listEditions, openEdition } from './edition-folder';

const validFixture = fileURLToPath(new URL('../fixtures/valid', import.meta.url));

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
  cpSync(validFixture, editionDir, { recursive: true });
  change(editionDir);
  return editionsDir;
}

function editJson(path: string, edit: (json: Json) => Json): void {
  writeFileSync(path, JSON.stringify(edit(JSON.parse(readFileSync(path, 'utf8')) as Json)));
}

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

describe('openEdition', () => {
  it('opens an Edition by its id with its config checked', () => {
    const editionsDir = editionsWith();

    const edition = openEdition(editionsDir, 'fixture');

    expect(edition.id).toBe('fixture');
    expect(edition.dir).toBe(join(editionsDir, 'fixture'));
  });

  it('refuses an unknown Edition and names the known ones', () => {
    const editionsDir = editionsWith();

    const failure = failureOf(() => openEdition(editionsDir, 'xx'));

    expect(failure).toMatchObject({ reason: 'unknown', editionId: 'xx', errors: [] });
    expect(failure?.message).toMatch(/Unknown Edition "xx".*Known Editions: fixture/s);
  });

  it.each(['../fixture', 'fixture/', '', 'fixture/content'])(
    'refuses "%s", which is not the folder of an Edition',
    (editionId) => {
      const editionsDir = editionsWith();

      expect(failureOf(() => openEdition(editionsDir, editionId))?.reason).toBe('unknown');
    },
  );

  it('refuses an Edition whose id differs from its folder name', () => {
    const editionsDir = editionsWith({ folder: 'uk' });

    const failure = failureOf(() => openEdition(editionsDir, 'uk'));

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

    const failure = failureOf(() => openEdition(editionsDir, 'fixture'));

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

    expect(failureOf(() => openEdition(editionsDir, 'fixture'))?.errors).toEqual([
      { file: 'edition.json', message: expect.stringMatching(/^Invalid JSON/) as string },
    ]);
  });
});

describe('an Edition folder', () => {
  it('reads a file against its contract', () => {
    const edition = openEdition(editionsWith(), 'fixture');

    expect(edition.read('manifest').contentVersion).toBeGreaterThan(0);
    expect(edition.read('idRegistry')).toContain('w_fx0001');
  });

  it('reports a missing file it needs', () => {
    const edition = openEdition(editionsWith(), 'fixture');

    expect(failureOf(() => edition.read('strings'))).toMatchObject({
      reason: 'invalid',
      errors: [{ file: 'strings.json', message: 'File not found' }],
    });
  });

  it('reads a missing optional file as absent', () => {
    const edition = openEdition(editionsWith(), 'fixture');

    expect(edition.readIfPresent('tokens')).toBeUndefined();
    expect(edition.readIfPresent('decor')).toBeUndefined();
    expect(edition.readIfPresent('targets')).toBeUndefined();
  });

  it('reads a missing id registry as absent, so the caller decides whether it may be', () => {
    const edition = openEdition(
      editionsWith({
        change: (dir) => {
          rmSync(join(dir, 'content/ids.json'));
        },
      }),
      'fixture',
    );

    expect(edition.readIfPresent('idRegistry')).toBeUndefined();
    expect(failureOf(() => edition.read('idRegistry'))?.errors).toEqual([
      { file: 'content/ids.json', message: 'File not found' },
    ]);
  });

  it('reports a malformed id registry, even where it is optional', () => {
    const edition = openEdition(
      editionsWith({
        change: (dir) => {
          writeFileSync(join(dir, 'content/ids.json'), JSON.stringify(['w_fx0001', 'w_fx0001']));
        },
      }),
      'fixture',
    );

    expect(failureOf(() => edition.readIfPresent('idRegistry'))?.errors).toEqual([
      { file: 'content/ids.json', message: 'Ids must not repeat' },
    ]);
  });

  it('names an id in the registry that is not an Entry id', () => {
    const edition = openEdition(
      editionsWith({
        change: (dir) => {
          writeFileSync(join(dir, 'content/ids.json'), JSON.stringify(['w_fx0001', 'nope']));
        },
      }),
      'fixture',
    );

    expect(failureOf(() => edition.read('idRegistry'))?.errors).toEqual([
      { file: 'content/ids.json', field: '1', message: expect.any(String) as string },
    ]);
  });

  it('knows where its files, assets and built pack lie', () => {
    const edition = openEdition(editionsWith(), 'fixture');

    expect(edition.path('config')).toBe(join(edition.dir, 'edition.json'));
    expect(edition.path('languagePack')).toBe(join(edition.dir, 'dist/language-pack.db'));
    expect(edition.asset('notification.wav')).toBe(join(edition.dir, 'assets/notification.wav'));
  });

  it('lists the font files it brings, in code-unit order', () => {
    const edition = openEdition(
      editionsWith({
        change: (dir) => {
          mkdirSync(join(dir, 'assets/fonts'), { recursive: true });
          for (const file of ['Serif.ttf', 'Sans.otf', 'README.md']) {
            writeFileSync(join(dir, 'assets/fonts', file), '');
          }
        },
      }),
      'fixture',
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

    expect(openEdition(editionsDir, 'fixture').fonts()).toEqual([]);
  });
});

describe('checkNewWords', () => {
  const draft = (changes: Json = {}): Word =>
    WordSchema.parse({
      ...(JSON.parse(
        readFileSync(join(validFixture, 'content/words/w_fx0002.json'), 'utf8'),
      ) as Json),
      id: 'w_draft1',
      lemma: 'снігур',
      stress: [4],
      primaryDefinition: 'Лісовий птах із червоними грудьми.',
      correctionIds: [],
      ...changes,
    });
  const draftFile = 'content/words/w_draft1.json';

  it('accepts a draft the build would accept', () => {
    expect(openEdition(editionsWith(), 'fixture').checkNewWords([draft()])).toEqual([]);
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
    expect(openEdition(editionsWith(), 'fixture').checkNewWords([draft(changes)])).toEqual([
      {
        file: draftFile,
        entryId: 'w_draft1',
        field,
        message: expect.stringMatching(message) as string,
      },
    ]);
  });

  it('reports a draft with the Lemma and primary Definition of an existing Word', () => {
    const edition = openEdition(editionsWith(), 'fixture');
    const existing = WordSchema.parse(
      JSON.parse(readFileSync(join(validFixture, 'content/words/w_fx0002.json'), 'utf8')),
    );

    const errors = edition.checkNewWords([
      draft({
        lemma: existing.lemma,
        stress: existing.stress,
        primaryDefinition: existing.primaryDefinition,
      }),
    ]);

    expect(errors).toEqual([
      {
        file: draftFile,
        entryId: 'w_draft1',
        field: 'primaryDefinition',
        message: expect.stringMatching(/same lemma and primary definition as w_fx0002/i) as string,
      },
    ]);
  });

  it('reports Stress in an Edition that does not mark Stress', () => {
    const edition = openEdition(
      editionsWith({
        change: (dir) => {
          editJson(join(dir, 'edition.json'), (config) => ({
            ...config,
            languageTraits: { ...(config['languageTraits'] as Json), marksStress: false },
          }));
        },
      }),
      'fixture',
    );

    expect(edition.checkNewWords([draft()])).toEqual([
      {
        file: draftFile,
        entryId: 'w_draft1',
        field: 'stress',
        message: 'Not allowed: the Edition does not mark Stress',
      },
    ]);
  });

  it('leaves out the errors of the existing content', () => {
    const edition = openEdition(
      editionsWith({
        change: (dir) => {
          editJson(join(dir, 'content/words/w_fx0002.json'), (word) => ({
            ...word,
            categoryId: 'x',
          }));
        },
      }),
      'fixture',
    );

    expect(edition.checkNewWords([draft()])).toEqual([]);
  });
});
