import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CorrectionSchema, EditionConfigSchema, WordSchema, type Entry } from '@slovo/contracts';
import { z } from 'zod';

import type { BuildError } from './build-error';
import { checkContent, type Authored } from './check-content';
import { contentChecksum } from './checksum';
import type { PackContent, PackMetadata } from './pack-layout';
import { contentReport, type ContentReport } from './report';
import { writePack } from './write-pack';

const EDITION_CONFIG_FILE = 'edition.json';
const MANIFEST_FILE = 'content/manifest.json';
const WORDS_DIR = 'content/words';
const CORRECTIONS_DIR = 'content/corrections';

/** Describes the content as a whole; the content version grows with every content release. */
const ContentManifestSchema = z.strictObject({
  contentVersion: z.int().positive(),
});

export type BuildResult =
  | {
      readonly ok: true;
      readonly metadata: PackMetadata;
      readonly wordCount: number;
      readonly correctionCount: number;
      readonly report: ContentReport;
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Validates an Edition's config and content, Entry by Entry and across
 * Entries, and compiles them into a SQLite Language Pack at `outFile` with a
 * content report. Nothing is written when there are errors.
 */
export function buildLanguagePack({
  editionDir,
  outFile,
}: {
  editionDir: string;
  outFile: string;
}): BuildResult {
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
      errors.push({
        file,
        ...(entryId === undefined ? {} : { entryId }),
        ...(issue.path.length === 0 ? {} : { field: issue.path.join('.') }),
        message: issue.message,
      });
    }
    return undefined;
  }

  function parseEntries<T extends Entry>(dir: string, schema: z.ZodType<T>): Authored<T>[] {
    return listJsonFiles(editionDir, dir).flatMap((file) => {
      const entry = parseFile(file, schema, true);
      return entry === undefined ? [] : [{ file, entry }];
    });
  }

  const config = parseFile(EDITION_CONFIG_FILE, EditionConfigSchema);
  const manifest = parseFile(MANIFEST_FILE, ContentManifestSchema);
  const words = parseEntries(WORDS_DIR, WordSchema);
  const corrections = parseEntries(CORRECTIONS_DIR, CorrectionSchema);
  if (config !== undefined) errors.push(...checkContent(config, words, corrections));

  if (errors.length > 0 || config === undefined || manifest === undefined) {
    return { ok: false, errors };
  }

  const content: PackContent = {
    editionId: config.id,
    contentVersion: manifest.contentVersion,
    categories: config.categories,
    words: sortedById(words),
    corrections: sortedById(corrections),
  };
  const metadata: PackMetadata = {
    editionId: content.editionId,
    contentVersion: content.contentVersion,
    checksum: contentChecksum(content),
  };
  writePack(outFile, content, metadata);
  return {
    ok: true,
    metadata,
    wordCount: content.words.length,
    correctionCount: content.corrections.length,
    report: contentReport(content),
  };
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

/** The JSON files of a content folder, relative to the Edition folder, in a stable order. */
function listJsonFiles(editionDir: string, dir: string): string[] {
  const path = join(editionDir, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => name.endsWith('.json'))
    .sort(compare)
    .map((name) => `${dir}/${name}`);
}

function entryIdOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined;
  return typeof value.id === 'string' && value.id !== '' ? value.id : undefined;
}

function sortedById<T extends Entry>(authored: readonly Authored<T>[]): T[] {
  return authored.map(({ entry }) => entry).toSorted((a, b) => compare(a.id, b.id));
}

/** Code-unit order, independent of the machine's locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
