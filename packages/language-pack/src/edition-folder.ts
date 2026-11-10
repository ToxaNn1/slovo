import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import {
  AppConfigSchema,
  CorrectionSchema,
  CrosswordDaysSchema,
  EditionConfigSchema,
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  IdiomSchema,
  SplashDecorSchema,
  SynonymRowSchema,
  TipSchema,
  CuratedCollectionSchema,
  WidgetSnapshotSchema,
  WordSchema,
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

import {
  checkContentSet,
  CROSSWORD_DAYS_FILE,
  parseAgainst,
  type Authored,
  type ContentSet,
} from '@slovo/content-rules';

import { buildErrorsOf, formatBuildError, type BuildError } from './build-error';
import { ContentManifestSchema, MANIFEST_FILE } from './content-manifest';
import { ContentTargetsSchema } from './content-targets';
import { ID_REGISTRY_FILE, IdRegistrySchema } from './id-registry';

/** The editions folder of this repo, which holds one folder per Edition. */
export const EDITIONS_DIR = fileURLToPath(new URL('../../../editions', import.meta.url));

/** The root of this repo, which holds the app's AppConfig. */
export const REPO_DIR = fileURLToPath(new URL('../../..', import.meta.url));

/** Where the repo keeps the AppConfig, the identity of the one app (ADR 0065). */
export const APP_CONFIG_FILE = 'app/app.json';

/** Where an Edition keeps the days of its Daily Crossword (ADR 0052). */
export { CROSSWORD_DAYS_FILE };

/** Where each file of an Edition lies in its folder. */
const FILES = {
  config: 'edition.json',
  strings: 'strings.json',
  tokens: 'tokens.json',
  decor: 'decor/decor.json',
  widgetSnapshotExample: 'widget-snapshot.example.json',
  idRegistry: ID_REGISTRY_FILE,
  manifest: MANIFEST_FILE,
  targets: 'content/targets.json',
  crosswordDays: CROSSWORD_DAYS_FILE,
  languagePack: 'dist/language-pack.db',
} as const;

const ASSETS_DIR = 'assets';
/** Where an Edition keeps the fonts the app embeds. */
export const FONTS_DIR = 'assets/fonts';
/** Where an Edition keeps the Illustrations its Words name (ADR 0055). */
export const ILLUSTRATIONS_DIR = 'assets/illustrations';
/**
 * An entry of the Recordings folder: a folder of one Narrator Voice, or a
 * stray file. A voice folder lists its files (the Recordings, by Word id),
 * any folder inside it, and its texts file read once: for each Word id, the
 * text its Recording was made from (ADR 0083).
 */
export type RecordingFolderEntry =
  | {
      readonly kind: 'folder';
      readonly name: string;
      readonly files: readonly string[];
      readonly folders: readonly string[];
      readonly texts: RecordedTexts;
    }
  | { readonly kind: 'file'; readonly name: string };

/** The texts file of a Narrator Voice folder: absent counts as no text recorded. */
export type RecordedTexts =
  | { readonly kind: 'texts'; readonly byWord: ReadonlyMap<string, string> }
  | { readonly kind: 'invalid' };

/** The file of a Narrator Voice folder that maps each Word id to the text its Recording was made from. */
export const RECORDED_TEXTS_FILE = 'texts.json';
const recordedTexts = z.record(z.string(), z.string());

/** Where an Edition keeps its Recordings, a folder per Narrator Voice (ADR 0083). */
export const RECORDINGS_DIR = 'assets/recordings';
/** Where an Edition keeps its legal pages, one Markdown file per page (ADR 0049). */
const LEGAL_DIR = 'legal';
const WORDS_DIR = 'content/words';
const CORRECTIONS_DIR = 'content/corrections';
const IDIOMS_DIR = 'content/idioms';
const SYNONYM_ROWS_DIR = 'content/synonym-rows';
const TIPS_DIR = 'content/tips';
/** The Curated Collections of the Edition, one `<id>.json` each (ADR 0076); the folder is optional. */
const CURATED_COLLECTIONS_DIR = 'content/curated-collections';

/** The folder each kind of Entry is authored in, by the prefix of its id. */
const ENTRY_DIRS: Record<string, string> = {
  w_: WORDS_DIR,
  c_: CORRECTIONS_DIR,
  i_: IDIOMS_DIR,
  r_: SYNONYM_ROWS_DIR,
  t_: TIPS_DIR,
  cc: CURATED_COLLECTIONS_DIR,
};

/** The contract each JSON file of an Edition is checked against. */
const SCHEMAS = {
  config: EditionConfigSchema,
  strings: EditionStringsSchema,
  tokens: EditionTokensSchema,
  decor: EditionDecorSchema,
  widgetSnapshotExample: WidgetSnapshotSchema,
  idRegistry: IdRegistrySchema,
  manifest: ContentManifestSchema,
  targets: ContentTargetsSchema,
  crosswordDays: CrosswordDaysSchema,
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

/** The content of an Edition's Entry folders, each Entry with the file it was authored in. */
export interface AuthoredContent {
  readonly words: readonly Authored<Word>[];
  readonly corrections: readonly Authored<Correction>[];
  readonly idioms: readonly Authored<Idiom>[];
  readonly synonymRows: readonly Authored<SynonymRow>[];
  readonly tips: readonly Authored<Tip>[];
  /** The Curated Collections, each with its file; none when the Edition has no such folder (ADR 0076). */
  readonly curatedCollections: readonly Authored<CuratedCollection>[];
  /** The Entry files that couldn't be read or broke the schema; the other Entries are kept. */
  readonly errors: readonly BuildError[];
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
  /** Where the Illustration a Word names lies, whether or not it is there. */
  illustration(name: string): string;
  /** The file names of the Illustrations the Edition brings (its PNGs), in code-unit order. */
  illustrations(): string[];
  /**
   * What the Edition's Recordings folder holds: each entry by name, in
   * code-unit order, and for a folder the names of its files, also in order.
   */
  recordings(): RecordingFolderEntry[];
  /** Where a Recording lies, whether or not it is there. */
  recording(voice: string, name: string): string;
  /** Every font file the Edition brings, in code-unit order. */
  fonts(): string[];
  /** Every legal page the Edition brings, its Markdown files, in code-unit order (ADR 0049). */
  legalPages(): string[];
  /** Every Word, Correction, Idiom, Synonym Row and Tip the Edition authors, in a stable order. */
  entries(): AuthoredContent;
  /** The text of every Entry `entries` reads, kind by kind; Entries that break their schema are left out. */
  entryTexts(): EntryText[];
  /** The file an Entry with this id is authored in, relative to the folder. */
  entryFile(id: string): string;
}

/** An Edition opened by its id: its folder, with its config checked. */
export interface EditionFolder extends EditionFiles {
  readonly id: string;
  readonly config: EditionConfig;
  /**
   * Checks Words that are not in the Edition yet with the build's own checks,
   * against the Edition's existing Entries, and returns the
   * errors that belong to the new Words. The Words must have passed the Word
   * schema. Each is located in the file it would be authored in, so an error
   * reads as the build would print it. The errors of the existing content are
   * left out: `pnpm build:pack` reports those.
   */
  checkNewWords(words: readonly Word[]): BuildError[];
  /** Checks new Idioms the way `checkNewWords` checks new Words. The Idioms must have passed the Idiom schema. */
  checkNewIdioms(idioms: readonly Idiom[]): BuildError[];
  /** Checks Corrections that are not in the Edition yet, as `checkNewWords` checks Words. */
  checkNewCorrections(corrections: readonly Correction[]): BuildError[];
  /** Checks new Synonym Rows the way `checkNewWords` checks new Words. The rows must have passed the Synonym Row schema. */
  checkNewSynonymRows(rows: readonly SynonymRow[]): BuildError[];
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
 * Opens the Edition with the given id in an editions folder. The id must
 * name one of its Editions, and the Edition's config must be valid and carry
 * the folder's name as its id, since the app, Metro and the Language Pack
 * look the Edition up by it. Throws an EditionFolderError otherwise.
 */
export function openEdition(editionsDir: string, editionId: string): EditionFolder {
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
  let content: AuthoredContent | undefined;
  return {
    ...files,
    id: editionId,
    config,
    checkNewWords(words) {
      return checkNew((set) => ({ ...set, words: [...set.words, ...authored(words)] }));
    },
    checkNewCorrections(corrections) {
      return checkNew((set) => ({
        ...set,
        corrections: [...set.corrections, ...authored(corrections)],
      }));
    },
    checkNewIdioms(idioms) {
      return checkNew((set) => ({ ...set, idioms: [...set.idioms, ...authored(idioms)] }));
    },
    checkNewSynonymRows(rows) {
      return checkNew((set) => ({ ...set, synonymRows: authored(rows) }));
    },
  };

  /** The content rules' refusals of the new records that `withNew` adds to the authored content. */
  function checkNew(withNew: (set: ContentSet) => ContentSet): BuildError[] {
    content ??= files.entries();
    const set = withNew(content);
    const old = new Set(
      [content.words, content.corrections, content.idioms, content.synonymRows].flat(),
    );
    const drafts = [set.words, set.corrections, set.idioms, set.synonymRows]
      .flat()
      .filter((r) => !old.has(r));
    return onlyIn(drafts, buildErrorsOf(checkContentSet(config, set, { today: new Date() })));
  }

  /** New Entries, each located in the file it would be authored in. */
  function authored<E extends { readonly id: string }>(entries: readonly E[]): Authored<E>[] {
    return entries.map((entry) => ({ file: files.entryFile(entry.id), entry }));
  }
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
    illustration: (name) => join(dir, ILLUSTRATIONS_DIR, name),
    illustrations() {
      const illustrationsDir = join(dir, ILLUSTRATIONS_DIR);
      if (!existsSync(illustrationsDir)) return [];
      return readdirSync(illustrationsDir)
        .filter((file) => file.endsWith('.png'))
        .toSorted();
    },
    recordings() {
      const recordingsDir = join(dir, RECORDINGS_DIR);
      if (!existsSync(recordingsDir)) return [];
      return readdirSync(recordingsDir, { withFileTypes: true })
        .toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((entry): RecordingFolderEntry => {
          if (!entry.isDirectory()) return { kind: 'file', name: entry.name };
          const voiceDir = join(recordingsDir, entry.name);
          const inside = readdirSync(voiceDir, { withFileTypes: true });
          const names = (keep: (item: (typeof inside)[number]) => boolean) =>
            inside
              .filter(keep)
              .map(({ name }) => name)
              .toSorted();
          return {
            kind: 'folder',
            name: entry.name,
            files: names((item) => !item.isDirectory() && item.name !== RECORDED_TEXTS_FILE),
            folders: names((item) => item.isDirectory()),
            texts: readRecordedTexts(join(voiceDir, RECORDED_TEXTS_FILE)),
          };
        });
    },
    recording: (voice, name) => join(dir, RECORDINGS_DIR, voice, name),
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
    entries,
    entryTexts: () => entryTextsOf(entries()),
    entryFile: (id) => `${ENTRY_DIRS[id.slice(0, 2)] ?? CORRECTIONS_DIR}/${id}.json`,
  };

  function entries(): AuthoredContent {
    const errors: BuildError[] = [];
    const words = readEntries(dir, WORDS_DIR, WordSchema, errors);
    const corrections = readEntries(dir, CORRECTIONS_DIR, CorrectionSchema, errors);
    const idioms = readEntries(dir, IDIOMS_DIR, IdiomSchema, errors);
    const synonymRows = readEntries(dir, SYNONYM_ROWS_DIR, SynonymRowSchema, errors);
    const tips = readEntries(dir, TIPS_DIR, TipSchema, errors);
    const curatedCollections = existsSync(join(dir, CURATED_COLLECTIONS_DIR))
      ? readEntries(dir, CURATED_COLLECTIONS_DIR, CuratedCollectionSchema, errors)
      : [];
    return { words, corrections, idioms, synonymRows, tips, curatedCollections, errors };
  }
}

/** The texts of the Entries, kind by kind in the order `entries` reads them. */
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

/**
 * The Entries of one Entry folder, in a stable order. The folder must exist
 * and hold `<id>.json` files only, each named after the id of its Entry;
 * hidden files such as `.DS_Store` are skipped.
 */
function readEntries<T extends { readonly id: string }>(
  editionDir: string,
  entryDir: string,
  schema: z.ZodType<T>,
  errors: BuildError[],
): Authored<T>[] {
  const path = join(editionDir, entryDir);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    errors.push({ file: entryDir, message: 'Folder not found' });
    return [];
  }
  const authored: Authored<T>[] = [];
  for (const name of readdirSync(path).toSorted()) {
    if (name.startsWith('.')) continue;
    const file = `${entryDir}/${name}`;
    if (!lstatSync(join(path, name)).isFile() || !name.endsWith('.json')) {
      errors.push({ file, message: 'Expected only files named <id>.json here' });
      continue;
    }
    const result = parseFile(editionDir, file, schema, true);
    if (!result.ok) {
      errors.push(...result.errors);
      continue;
    }
    const entry = result.value;
    if (name !== `${entry.id}.json`) {
      const message = `Expected the file to be named ${entry.id}.json, after its id`;
      errors.push({ file, entryId: entry.id, field: 'id', message });
    }
    authored.push({ file, entry });
  }
  return authored;
}

/** A JSON file of the Edition checked against a schema, with every problem named by its field. */
function parseFile<T>(
  editionDir: string,
  file: string,
  schema: z.ZodType<T>,
  isEntry = false,
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
  const result = parseAgainst(schema, file, json, { isEntry });
  return result.ok ? result : { ok: false, errors: buildErrorsOf(result.refusals) };
}

/** The texts file of a Narrator Voice folder, parsed once where it enters. */
function readRecordedTexts(file: string): RecordedTexts {
  if (!existsSync(file)) return { kind: 'texts', byWord: new Map() };
  try {
    const parsed = recordedTexts.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success
      ? { kind: 'texts', byWord: new Map(Object.entries(parsed.data)) }
      : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}
