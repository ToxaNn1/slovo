import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import {
  CorrectionSchema,
  EditionConfigSchema,
  WordSchema,
  type Correction,
  type EditionConfig,
  type Entry,
  type Word,
} from '@slovo/contracts';
import type { z } from 'zod';

import type { BuildError } from './build-error';
import { checkContent, type Authored } from './check-content';
import { ContentManifestSchema, MANIFEST_FILE, type ContentManifest } from './content-manifest';
import { ContentTargetsSchema, type ContentTargets } from './content-targets';
import { ID_REGISTRY_FILE, IdRegistrySchema, missingEntryErrors } from './id-registry';
import type { PackContent } from './pack-layout';

const EDITION_CONFIG_FILE = 'edition.json';
const WORDS_DIR = 'content/words';
const CORRECTIONS_DIR = 'content/corrections';
const TARGETS_FILE = 'content/targets.json';

/** An Edition's folder as read and checked, ready to compile when nothing is wrong. */
export interface EditionSource {
  readonly errors: readonly BuildError[];
  /** The Edition config, when it could be read. */
  readonly config?: EditionConfig;
  /** The Edition id, when the config could be read. */
  readonly editionId?: string;
  readonly words: readonly Authored<Word>[];
  readonly corrections: readonly Authored<Correction>[];
  /** The known ids: none when the registry is optional and missing, unset when it can't be read. */
  readonly registry?: readonly string[];
  /** Set when there are no errors. */
  readonly valid?: {
    /** The content at the version the manifest records. */
    readonly content: PackContent;
    readonly manifest: ContentManifest;
    readonly targets: ContentTargets;
  };
}

/**
 * Reads an Edition's config and content and checks them Entry by Entry,
 * across Entries and against the id registry. It leaves to the caller
 * whether every Entry is registered and whether the manifest records the
 * content as it is.
 */
export function readEdition(
  editionDir: string,
  { registryRequired }: { registryRequired: boolean },
): EditionSource {
  const errors: BuildError[] = [];

  function parseFile<T>(file: string, schema: z.ZodType<T>, isEntry = false): T | undefined {
    const json = readJson(editionDir, file);
    if (!json.ok) {
      errors.push({ file, message: json.message });
      return undefined;
    }
    const result = schema.safeParse(json.value);
    if (result.success) return result.data;
    const entryId = isEntry ? entryIdOf(json.value) : undefined;
    for (const issue of result.error.issues) {
      // An unknown key is reported on the object holding it, so name each key as the field.
      const problems =
        issue.code === 'unrecognized_keys'
          ? issue.keys.map((key) => ({ path: [...issue.path, key], message: 'Unknown field' }))
          : [{ path: issue.path, message: issue.message }];
      for (const { path, message } of problems) {
        errors.push({
          file,
          ...(entryId === undefined ? {} : { entryId }),
          ...(path.length === 0 ? {} : { field: path.join('.') }),
          message,
        });
      }
    }
    return undefined;
  }

  function parseEntries<T extends Entry>(dir: string, schema: z.ZodType<T>): Authored<T>[] {
    return listEntryFiles(dir).flatMap((file) => {
      const entry = parseFile(file, schema, true);
      if (entry === undefined) return [];
      if (basename(file) !== `${entry.id}.json`) {
        const message = `Expected the file to be named ${entry.id}.json, after its id`;
        errors.push({ file, entryId: entry.id, field: 'id', message });
      }
      return [{ file, entry }];
    });
  }

  /**
   * The files of an Entry folder, relative to the Edition folder, in a stable
   * order. The folder must exist and hold `<id>.json` files only; hidden files
   * such as `.DS_Store` are skipped.
   */
  function listEntryFiles(dir: string): string[] {
    const path = join(editionDir, dir);
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      errors.push({ file: dir, message: 'Folder not found' });
      return [];
    }
    const files: string[] = [];
    for (const item of readdirSync(path, { withFileTypes: true }).toSorted((a, b) =>
      compare(a.name, b.name),
    )) {
      if (item.name.startsWith('.')) continue;
      const file = `${dir}/${item.name}`;
      if (item.isFile() && item.name.endsWith('.json')) files.push(file);
      else errors.push({ file, message: 'Expected only Entry files named <id>.json here' });
    }
    return files;
  }

  const config = parseFile(EDITION_CONFIG_FILE, EditionConfigSchema);
  const manifest = parseFile(MANIFEST_FILE, ContentManifestSchema);
  const words = parseEntries(WORDS_DIR, WordSchema);
  const corrections = parseEntries(CORRECTIONS_DIR, CorrectionSchema);
  const targets = existsSync(join(editionDir, TARGETS_FILE))
    ? parseFile(TARGETS_FILE, ContentTargetsSchema)
    : {};
  const registry =
    registryRequired || existsSync(join(editionDir, ID_REGISTRY_FILE))
      ? parseFile(ID_REGISTRY_FILE, IdRegistrySchema)
      : [];
  if (config !== undefined) errors.push(...checkContent(config, words, corrections));
  if (registry !== undefined) {
    errors.push(...missingEntryErrors(registry, (file) => existsSync(join(editionDir, file))));
  }

  const source = {
    errors,
    words,
    corrections,
    ...(config === undefined ? {} : { config, editionId: config.id }),
    ...(registry === undefined ? {} : { registry }),
  };
  if (
    errors.length > 0 ||
    config === undefined ||
    manifest === undefined ||
    targets === undefined
  ) {
    return source;
  }
  const content: PackContent = {
    editionId: config.id,
    contentVersion: manifest.contentVersion,
    categories: config.categories,
    words: sortedById(words),
    corrections: sortedById(corrections),
  };
  return { ...source, valid: { content, manifest, targets } };
}

function readJson(
  editionDir: string,
  file: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const path = join(editionDir, file);
  if (!existsSync(path)) return { ok: false, message: 'File not found' };
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { ok: false, message: `Invalid JSON: ${(error as Error).message}` };
  }
}

function entryIdOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined;
  return typeof value.id === 'string' && value.id !== '' ? value.id : undefined;
}

function sortedById<T extends Entry>(authored: readonly Authored<T>[]): T[] {
  return authored.map(({ entry }) => entry).toSorted((a, b) => compare(a.id, b.id));
}

/** Code-unit order, independent of the machine's locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
