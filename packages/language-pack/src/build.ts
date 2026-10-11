import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CorrectionSchema, EditionConfigSchema, WordSchema, type Entry } from '@slovo/contracts';
import { z } from 'zod';

import type { BuildError } from './build-error';
import { checkContent, type Authored } from './check-content';
import { contentChecksum } from './checksum';
import { ContentTargetsSchema, missedTargets, type MissedTarget } from './content-targets';
import type { PackContent, PackMetadata } from './pack-layout';
import { contentReport, type ContentReport } from './report';
import { writePack } from './write-pack';

const EDITION_CONFIG_FILE = 'edition.json';
const MANIFEST_FILE = 'content/manifest.json';
const WORDS_DIR = 'content/words';
const CORRECTIONS_DIR = 'content/corrections';
const TARGETS_FILE = 'content/targets.json';

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
      /** The content targets the Edition declares and the content misses. */
      readonly missedTargets: readonly MissedTarget[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Validates an Edition's config and content, Entry by Entry and across
 * Entries, and compiles them into a SQLite Language Pack at `outFile` with a
 * content report, checked against the content targets the Edition declares.
 * Nothing is written when there are errors; missed targets are not errors.
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
    return listJsonFiles(editionDir, dir).flatMap((file) => {
      const entry = parseFile(file, schema, true);
      return entry === undefined ? [] : [{ file, entry }];
    });
  }

  const config = parseFile(EDITION_CONFIG_FILE, EditionConfigSchema);
  const manifest = parseFile(MANIFEST_FILE, ContentManifestSchema);
  const words = parseEntries(WORDS_DIR, WordSchema);
  const corrections = parseEntries(CORRECTIONS_DIR, CorrectionSchema);
  const targets = existsSync(join(editionDir, TARGETS_FILE))
    ? parseFile(TARGETS_FILE, ContentTargetsSchema)
    : {};
  if (config !== undefined) errors.push(...checkContent(config, words, corrections));

  if (
    errors.length > 0 ||
    config === undefined ||
    manifest === undefined ||
    targets === undefined
  ) {
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
  const report = contentReport(content);
  return {
    ok: true,
    metadata,
    wordCount: content.words.length,
    correctionCount: content.corrections.length,
    report,
    missedTargets: missedTargets(report, targets),
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
