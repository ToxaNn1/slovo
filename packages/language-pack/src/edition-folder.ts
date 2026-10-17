import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CorrectionSchema,
  EditionConfigSchema,
  EditionDecorSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  SplashDecorSchema,
  WidgetSnapshotSchema,
  WordSchema,
  type Correction,
  type EditionConfig,
  type Entry,
  type Word,
} from '@slovo/contracts';
import type { z } from 'zod';

import { formatBuildError, type BuildError } from './build-error';
import { checkContent, type Authored } from './check-content';
import { ContentManifestSchema, MANIFEST_FILE } from './content-manifest';
import { ContentTargetsSchema } from './content-targets';
import { ID_REGISTRY_FILE, IdRegistrySchema } from './id-registry';

/** The editions folder of this repo, which holds one folder per Edition. */
export const EDITIONS_DIR = fileURLToPath(new URL('../../../editions', import.meta.url));

/** Where each file of an Edition lies in its folder. */
const FILES = {
  config: 'edition.json',
  strings: 'strings.json',
  tokens: 'tokens.json',
  decor: 'decor/decor.json',
  splash: 'decor/splash.json',
  widgetSnapshotExample: 'widget-snapshot.example.json',
  idRegistry: ID_REGISTRY_FILE,
  manifest: MANIFEST_FILE,
  targets: 'content/targets.json',
  icon: 'assets/icon.png',
  languagePack: 'dist/language-pack.db',
} as const;

const ASSETS_DIR = 'assets';
const FONTS_DIR = 'assets/fonts';
const DECOR_DIR = 'decor';
const WORDS_DIR = 'content/words';
const CORRECTIONS_DIR = 'content/corrections';

/** The contract each JSON file of an Edition is checked against. */
const SCHEMAS = {
  config: EditionConfigSchema,
  strings: EditionStringsSchema,
  tokens: EditionTokensSchema,
  decor: EditionDecorSchema,
  splash: SplashDecorSchema,
  widgetSnapshotExample: WidgetSnapshotSchema,
  idRegistry: IdRegistrySchema,
  manifest: ContentManifestSchema,
  targets: ContentTargetsSchema,
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

/** The content of an Edition's Entry folders, each Entry with the file it was authored in. */
export interface AuthoredContent {
  readonly words: readonly Authored<Word>[];
  readonly corrections: readonly Authored<Correction>[];
  /** The Entry files that couldn't be read or broke the schema; the other Entries are kept. */
  readonly errors: readonly BuildError[];
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
  /** Where a file of the Edition's Decor lies, such as a splash image. */
  decorFile(name: string): string;
  /** Every font file the Edition brings, in code-unit order. */
  fonts(): string[];
  /** Every Word and Correction the Edition authors, in a stable order. */
  entries(): AuthoredContent;
  /** The file an Entry with this id is authored in, relative to the folder. */
  entryFile(id: string): string;
}

/** An Edition opened by its id: its folder, with its config checked. */
export interface EditionFolder extends EditionFiles {
  readonly id: string;
  readonly config: EditionConfig;
  /**
   * Checks Words that are not in the Edition yet with the build's own checks,
   * against the Edition's existing Words and Corrections, and returns the
   * errors that belong to the new Words. The Words must have passed the Word
   * schema. Each is located in the file it would be authored in, so an error
   * reads as the build would print it. The errors of the existing content are
   * left out: `pnpm build:pack` reports those.
   */
  checkNewWords(words: readonly Word[]): BuildError[];
}

/** The ids of the Editions in an editions folder: each sub-folder holding an Edition config, in code-unit order. */
export function listEditions(editionsDir: string): string[] {
  return readdirSync(editionsDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && existsSync(join(editionsDir, item.name, FILES.config)))
    .map((item) => item.name)
    .toSorted();
}

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
      content ??= files.entries();
      const drafts = words.map((word) => ({ file: files.entryFile(word.id), entry: word }));
      const draftFiles = new Set(drafts.map(({ file }) => file));
      return checkContent(config, [...content.words, ...drafts], content.corrections).filter(
        ({ file }) => draftFiles.has(file),
      );
    },
  };
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
    decorFile: (name) => join(dir, DECOR_DIR, name),
    fonts() {
      const fontsDir = join(dir, FONTS_DIR);
      if (!existsSync(fontsDir)) return [];
      return readdirSync(fontsDir)
        .filter((file) => /\.(otf|ttf)$/.test(file))
        .toSorted()
        .map((file) => join(fontsDir, file));
    },
    entries() {
      const errors: BuildError[] = [];
      const words = readEntries(dir, WORDS_DIR, WordSchema, errors);
      const corrections = readEntries(dir, CORRECTIONS_DIR, CorrectionSchema, errors);
      return { words, corrections, errors };
    },
    entryFile: (id) => `${id.startsWith('w_') ? WORDS_DIR : CORRECTIONS_DIR}/${id}.json`,
  };
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
function readEntries<T extends Entry>(
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
      errors.push({ file, message: 'Expected only Entry files named <id>.json here' });
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
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  const entryId = isEntry ? entryIdOf(json) : undefined;
  const errors = result.error.issues.flatMap((issue) =>
    // An unknown key is reported on the object holding it, so name each key as the field.
    (issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => ({ path: [...issue.path, key], message: 'Unknown field' }))
      : [{ path: issue.path, message: issue.message }]
    ).map(({ path: fieldPath, message }) => ({
      file,
      ...(entryId === undefined ? {} : { entryId }),
      ...(fieldPath.length === 0 ? {} : { field: fieldPath.join('.') }),
      message,
    })),
  );
  return { ok: false, errors };
}

function entryIdOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined;
  return typeof value.id === 'string' && value.id !== '' ? value.id : undefined;
}
