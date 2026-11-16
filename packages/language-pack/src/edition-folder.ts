import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import {
  AppConfigSchema,
  EditionConfigSchema,
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  SplashDecorSchema,
  WidgetSnapshotSchema,
  appReleaseProblems,
  type AppConfig,
  type Correction,
  type CuratedCollection,
  type EditionConfig,
  type EntryKind,
  type Idiom,
  type SplashDecor,
  type SynonymRow,
  type Tip,
  type Word,
} from '@slovo/contracts';
import { z } from 'zod';

import type { ContentSnapshot } from '@slovo/contracts/api';

import {
  checkContentSet,
  contentSetOf,
  parseAgainst,
  type Authored,
  type ContentSet,
} from '@slovo/content-rules';

import { buildErrorsOf, formatBuildError, type BuildError } from './build-error';

/** The editions folder of this repo, which holds one folder per Edition. */
export const EDITIONS_DIR = fileURLToPath(new URL('../../../editions', import.meta.url));

/** The root of this repo, which holds the app's AppConfig. */
export const REPO_DIR = fileURLToPath(new URL('../../..', import.meta.url));

/** Where the repo keeps the AppConfig, the identity of the one app (ADR 0065). */
export const APP_CONFIG_FILE = 'app/app.json';

/** Where each file of an Edition lies in its folder. */
const FILES = {
  config: 'edition.json',
  strings: 'strings.json',
  tokens: 'tokens.json',
  decor: 'decor/decor.json',
  widgetSnapshotExample: 'widget-snapshot.example.json',
  languagePack: 'dist/language-pack.db',
} as const;

const ASSETS_DIR = 'assets';
/** Where an Edition keeps the fonts the app embeds. */
export const FONTS_DIR = 'assets/fonts';
/** Where an Edition keeps its legal pages, one Markdown file per page (ADR 0049). */
const LEGAL_DIR = 'legal';

/** The contract each JSON file of an Edition is checked against. */
const SCHEMAS = {
  config: EditionConfigSchema,
  strings: EditionStringsSchema,
  tokens: EditionTokensSchema,
  decor: EditionDecorSchema,
  widgetSnapshotExample: WidgetSnapshotSchema,
} satisfies Partial<Record<EditionFile, z.ZodType>>;

/** A file of an Edition, named by what it holds. */
export type EditionFile = keyof typeof FILES;

/** A JSON file of an Edition, which is read checked against its contract. */
export type EditionJsonFile = keyof typeof SCHEMAS;

/** What a JSON file of an Edition holds once checked. */
export type EditionFileContent<F extends EditionJsonFile> = z.output<(typeof SCHEMAS)[F]>;

/** Why an Edition can't be opened or one of its files can't be read. */
export class EditionFolderError extends Error {
  override readonly name = 'EditionFolderError';

  constructor(
    /** `unknown`: no Edition has this id; `invalid`: a file of the Edition is missing or wrong. */
    readonly reason: 'unknown' | 'invalid',
    readonly editionId: string,
    /** Every problem, in the file it lies in; none for an unknown Edition. */
    readonly errors: readonly BuildError[],
    message: string,
  ) {
    super(message);
  }
}

/** Why the AppConfig can't be read: it is missing or wrong, or a release build refuses it. */
export class AppConfigError extends Error {
  override readonly name = 'AppConfigError';

  constructor(
    /** Every problem, in the file it lies in. */
    readonly errors: readonly BuildError[],
    message: string,
  ) {
    super(message);
  }
}

/** The AppConfig of a repo, with the files it names. */
export interface AppFolder {
  readonly config: AppConfig;
  /** Where the icon or the splash the AppConfig names lies, whether or not it is there. */
  path(file: 'icon' | 'splash'): string;
  /** The native splash, checked against its contract. */
  splash(): SplashDecor;
}

/**
 * Reads the AppConfig of the repo in `repoDir`. It must be valid, and for a
 * release build hold no placeholder, such as the `slovo.example` domain or an
 * empty Apple Team ID. Throws an AppConfigError otherwise.
 */
export function openAppConfig(
  repoDir: string,
  { build = 'development' }: { build?: EditionBuild } = {},
): AppFolder {
  const fail = (errors: readonly BuildError[]) => {
    const problems = errors.map((error) => `  ${formatBuildError(error)}`).join('\n');
    return new AppConfigError(errors, `The AppConfig in ${repoDir} is not valid:\n${problems}`);
  };
  const result = parseFile(repoDir, APP_CONFIG_FILE, AppConfigSchema);
  if (!result.ok) throw fail(result.errors);
  const config = result.value;
  const problems = build === 'release' ? appReleaseProblems(config) : [];
  if (problems.length > 0) {
    throw fail(problems.map(({ field, message }) => ({ file: APP_CONFIG_FILE, field, message })));
  }
  const path = (file: 'icon' | 'splash') => join(repoDir, config[file]);
  return {
    config,
    path,
    splash() {
      const splash = parseFile(repoDir, config.splash, SplashDecorSchema);
      if (!splash.ok) throw fail(splash.errors);
      return splash.value;
    },
  };
}

/** An Edition's records, each with the file its errors name (`snapshot:<kind>/<id>`). */
export interface AuthoredContent {
  readonly words: readonly Authored<Word>[];
  readonly corrections: readonly Authored<Correction>[];
  readonly idioms: readonly Authored<Idiom>[];
  readonly synonymRows: readonly Authored<SynonymRow>[];
  readonly tips: readonly Authored<Tip>[];
  /** The Curated Collections, each with its file (ADR 0076). */
  readonly curatedCollections: readonly Authored<CuratedCollection>[];
}

/**
 * The text an Entry is known by, so that a new Entry of the same text can be
 * told apart: a Word's Lemma, an Idiom's expression, a Correction's
 * non-standard form, a Synonym Row's dominant, a Tip's title. A Word also
 * carries its primary Definition: homonyms share a Lemma and are separate
 * Words, told apart by it (`wordKey`).
 */
export { wordKey } from '@slovo/content-rules';

export type EntryText = EntryTextFields &
  (
    | { readonly kind: 'word'; readonly primaryDefinition: string }
    | { readonly kind: Exclude<EntryKind, 'word'> }
  );

interface EntryTextFields {
  readonly id: string;
  /** The Word's Category, the Idiom Type or the Correction Type; none for Synonym Rows and Tips. */
  readonly group: string | undefined;
  readonly text: string;
  /** A Correction's standard equivalents, a Synonym Row's members, a Tip's forms. */
  readonly forms: readonly string[];
  /** A Retired Entry no user sees, but its text is taken. */
  readonly retired: boolean;
}

/** The files of an Edition folder, read checked against their contracts. */
export interface EditionFiles {
  /** The folder, as given. */
  readonly dir: string;
  /** Where a file of the Edition lies, whether or not it is there. */
  path(file: EditionFile): string;
  /** A JSON file checked against its contract; throws an EditionFolderError when it is missing or wrong. */
  read<F extends EditionJsonFile>(file: F): EditionFileContent<F>;
  /** Like `read`, but a missing file is undefined: the caller decides what that means. */
  readIfPresent<F extends EditionJsonFile>(file: F): EditionFileContent<F> | undefined;
  /** Where a file the Edition brings in `assets/` lies, such as its notification sound. */
  asset(name: string): string;
  /** Every font file the Edition brings, in code-unit order. */
  fonts(): string[];
  /** Every legal page the Edition brings, its Markdown files, in code-unit order (ADR 0049). */
  legalPages(): string[];
}

/**
 * An Edition opened by its id: its folder, with its config checked. It reads
 * its Entries once, on the first call that needs them, and every later call
 * sees that reading.
 */
export interface EditionFolder extends EditionFiles {
  readonly id: string;
  readonly config: EditionConfig;
  /** Every Word, Correction, Idiom, Synonym Row, Tip and Curated Collection it was opened with, in a stable order. */
  entries(): AuthoredContent;
  /** The text of every Entry `entries` gives, kind by kind. */
  entryTexts(): EntryText[];
  /**
   * Checks Words that are not in the Edition yet with the build's own checks,
   * against the Edition's existing Entries, and returns the
   * errors that belong to the new Words. The Words must have passed the Word
   * schema. Each is located in the file it would be authored in, so an error
   * reads as the build would print it. The errors of the existing content are
   * left out: `pnpm build:pack` reports those. Literary uses are judged
   * against the public domain on `today`, now by default.
   */
  checkNewWords(words: readonly Word[], today?: Date): BuildError[];
  /** Checks new Idioms the way `checkNewWords` checks new Words. The Idioms must have passed the Idiom schema. */
  checkNewIdioms(idioms: readonly Idiom[], today?: Date): BuildError[];
  /** Checks Corrections that are not in the Edition yet, as `checkNewWords` checks Words. */
  checkNewCorrections(corrections: readonly Correction[], today?: Date): BuildError[];
  /** Checks new Synonym Rows the way `checkNewWords` checks new Words. The rows must have passed the Synonym Row schema. */
  checkNewSynonymRows(rows: readonly SynonymRow[], today?: Date): BuildError[];
}

/** The ids of the Editions in an editions folder: each sub-folder holding an Edition config, in code-unit order. */
export function listEditions(editionsDir: string): string[] {
  return readdirSync(editionsDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && existsSync(join(editionsDir, item.name, FILES.config)))
    .map((item) => item.name)
    .toSorted();
}

/**
 * The build an AppConfig is opened for: a release build refuses the
 * placeholders a development build keeps, such as `slovo.example`.
 */
export type EditionBuild = 'development' | 'release';

/**
 * Opens the Edition with the given id in an editions folder, with the records
 * of a snapshot of the backend (ADR 0090, 0153): the config, assets and every
 * other file come from the folder. The id must name one of its Editions, and
 * the Edition's config must be valid and carry the folder's name as its id,
 * since the app, Metro and the Language Pack look the Edition up by it. Throws
 * an EditionFolderError otherwise, or when the snapshot is of another Edition.
 */
export function openEditionWithSnapshot(
  editionsDir: string,
  editionId: string,
  snapshot: ContentSnapshot,
): EditionFolder {
  if (snapshot.editionId !== editionId) {
    const message = `The snapshot is of Edition ${snapshot.editionId}, not ${editionId}`;
    throw new EditionFolderError('invalid', editionId, [{ file: SNAPSHOT_FILE, message }], message);
  }
  return open(editionsDir, editionId, () => snapshotEntries(snapshot));
}

/**
 * Opens the Edition with the given id for its config and files alone, with no
 * records, for a caller that reads none, such as the app config, Metro or a
 * check of drafts. Throws as `openEditionWithSnapshot` does.
 */
export function openEditionWithoutRecords(editionsDir: string, editionId: string): EditionFolder {
  return open(editionsDir, editionId, () => NO_RECORDS);
}

const NO_RECORDS: AuthoredContent = {
  words: [],
  corrections: [],
  idioms: [],
  synonymRows: [],
  tips: [],
  curatedCollections: [],
};

function open(
  editionsDir: string,
  editionId: string,
  recordsOf: () => AuthoredContent,
): EditionFolder {
  const known = listEditions(editionsDir);
  if (!known.includes(editionId)) {
    throw new EditionFolderError(
      'unknown',
      editionId,
      [],
      `Unknown Edition "${editionId}": no folder of ${editionsDir} by that name holds an ${FILES.config}. Known Editions: ${known.join(', ') || 'none'}`,
    );
  }
  const files = editionFiles(join(editionsDir, editionId));
  const config = files.read('config');
  if (config.id !== editionId) {
    throw invalid(files.dir, [
      {
        file: FILES.config,
        field: 'id',
        message: `The id "${config.id}" differs from its folder "${editionId}": the Edition is looked up by its folder name`,
      },
    ]);
  }
  let read: AuthoredContent | undefined;
  const entries = (): AuthoredContent => (read ??= recordsOf());
  return {
    ...files,
    id: editionId,
    config,
    entries,
    entryTexts: () => entryTextsOf(entries()),
    checkNewWords(words, today = new Date()) {
      return checkNew(today, (set) => ({ ...set, words: [...set.words, ...authored(words)] }));
    },
    checkNewCorrections(corrections, today = new Date()) {
      return checkNew(today, (set) => ({
        ...set,
        corrections: [...set.corrections, ...authored(corrections)],
      }));
    },
    checkNewIdioms(idioms, today = new Date()) {
      return checkNew(today, (set) => ({ ...set, idioms: [...set.idioms, ...authored(idioms)] }));
    },
    checkNewSynonymRows(rows, today = new Date()) {
      return checkNew(today, (set) => ({
        ...set,
        synonymRows: [...set.synonymRows, ...authored(rows)],
      }));
    },
  };

  /** The content rules' refusals, on `today`, of the new records that `withNew` adds to the authored content. */
  function checkNew(today: Date, withNew: (set: ContentSet) => ContentSet): BuildError[] {
    const content = entries();
    const set = withNew(content);
    const old = new Set(
      [content.words, content.corrections, content.idioms, content.synonymRows].flat(),
    );
    const drafts = [set.words, set.corrections, set.idioms, set.synonymRows]
      .flat()
      .filter((r) => !old.has(r));
    return onlyIn(drafts, buildErrorsOf(checkContentSet(config, set, { today })));
  }

  /** New Entries, each named `draft:<id>` as its file. */
  function authored<E extends { readonly id: string }>(entries: readonly E[]): Authored<E>[] {
    return entries.map((entry) => ({ file: `${DRAFT_FILE}:${entry.id}`, entry }));
  }
}

/** What the errors of a draft name as their file, with its id. */
export const DRAFT_FILE = 'draft';

/** What the errors of a snapshot name as their file. */
export const SNAPSHOT_FILE = 'snapshot';

/** A snapshot's records, each named `snapshot:<kind>/<id>` as its file. */
export function snapshotEntries(snapshot: ContentSnapshot): AuthoredContent {
  const { words, corrections, idioms, synonymRows, tips, curatedCollections } = contentSetOf(
    {
      word: snapshot.words,
      correction: snapshot.corrections,
      idiom: snapshot.idioms,
      synonymRow: snapshot.synonymRows,
      tip: snapshot.tips,
      curatedCollection: snapshot.curatedCollections,
      crosswordDay: snapshot.crosswordDays,
    },
    (kind, id) => `${SNAPSHOT_FILE}:${kind}/${id}`,
  );
  return { words, corrections, idioms, synonymRows, tips, curatedCollections };
}

/** The errors that belong to the given Entries' files. */
function onlyIn(drafts: readonly { readonly file: string }[], errors: BuildError[]): BuildError[] {
  const draftFiles = new Set(drafts.map(({ file }) => file));
  return errors.filter(({ file }) => draftFiles.has(file));
}

/**
 * The files of the Edition in a folder, whatever the folder is called. The
 * Language Pack build reads an Edition this way; everything else opens one
 * by its id.
 */
export function editionFiles(dir: string): EditionFiles {
  function read<F extends EditionJsonFile>(file: F): EditionFileContent<F> {
    const schema: z.ZodType = SCHEMAS[file];
    const result = parseFile(dir, FILES[file], schema);
    if (!result.ok) throw invalid(dir, result.errors);
    // The schema of the file is the one its content type is inferred from.
    return result.value as EditionFileContent<F>;
  }

  return {
    dir,
    path: (file) => join(dir, FILES[file]),
    read,
    readIfPresent: (file) => (existsSync(join(dir, FILES[file])) ? read(file) : undefined),
    asset: (name) => join(dir, ASSETS_DIR, name),
    fonts() {
      const fontsDir = join(dir, FONTS_DIR);
      if (!existsSync(fontsDir)) return [];
      return readdirSync(fontsDir)
        .filter((file) => /\.(otf|ttf)$/.test(file))
        .toSorted()
        .map((file) => join(fontsDir, file));
    },
    legalPages() {
      const legalDir = join(dir, LEGAL_DIR);
      if (!existsSync(legalDir)) return [];
      return readdirSync(legalDir)
        .filter((file) => file.endsWith('.md'))
        .toSorted()
        .map((file) => join(legalDir, file));
    },
  };
}

/** The texts of the Entries, kind by kind in the order `entries` gives them. */
function entryTextsOf({
  words,
  corrections,
  idioms,
  synonymRows,
  tips,
}: AuthoredContent): EntryText[] {
  const text = (
    kind: Exclude<EntryKind, 'word'>,
    entry: { readonly id: string; readonly retired: boolean },
    group: string | undefined,
    main: string,
    forms: readonly string[] = [],
  ): EntryText => ({ kind, id: entry.id, group, text: main, forms, retired: entry.retired });
  return [
    ...words.map(({ entry }): EntryText => ({
      kind: 'word',
      id: entry.id,
      group: entry.categoryId,
      text: entry.lemma,
      forms: [],
      retired: entry.retired,
      primaryDefinition: entry.primaryDefinition,
    })),
    ...corrections.map(({ entry }) =>
      text(
        'correction',
        entry,
        entry.correctionType,
        entry.nonStandardForm,
        entry.standardEquivalents,
      ),
    ),
    ...idioms.map(({ entry }) => text('idiom', entry, entry.idiomType, entry.expression)),
    ...synonymRows.map(({ entry }) =>
      text(
        'synonymRow',
        entry,
        undefined,
        entry.dominant.text,
        entry.members.map((member) => member.text),
      ),
    ),
    ...tips.map(({ entry }) =>
      text(
        'tip',
        entry,
        undefined,
        entry.title,
        entry.nonStandardForm === undefined
          ? [entry.standardForm]
          : [entry.nonStandardForm, entry.standardForm],
      ),
    ),
  ];
}

function invalid(dir: string, errors: readonly BuildError[]): EditionFolderError {
  const editionId = basename(dir);
  const problems = errors.map((error) => `  ${formatBuildError(error)}`).join('\n');
  return new EditionFolderError(
    'invalid',
    editionId,
    errors,
    `Edition "${editionId}" in ${dir} is not valid:\n${problems}`,
  );
}

/** A JSON file of the Edition checked against a schema, with every problem named by its field. */
function parseFile<T>(
  editionDir: string,
  file: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; errors: BuildError[] } {
  const path = join(editionDir, file);
  if (!existsSync(path)) return { ok: false, errors: [{ file, message: 'File not found' }] };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [{ file, message: `Invalid JSON: ${reason}` }] };
  }
  const result = parseAgainst(schema, file, json, { isEntry: false });
  return result.ok ? result : { ok: false, errors: buildErrorsOf(result.refusals) };
}
