import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Correction, Entry, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checkContent, type Authored } from './check-content';
import { checkSynonymRows } from './check-synonym-rows';
import type { ContentManifest } from './content-manifest';
import type { ContentTargets } from './content-targets';
import { editionFiles, EditionFolderError } from './edition-folder';
import { missingEntryErrors } from './id-registry';
import type { PackContent } from './pack-layout';

/** An Edition's folder as read and checked, ready to compile when nothing is wrong. */
export interface EditionSource {
  readonly errors: readonly BuildError[];
  /** The Edition id, when the config could be read. */
  readonly editionId?: string;
  readonly words: readonly Authored<Word>[];
  readonly corrections: readonly Authored<Correction>[];
  readonly idioms: readonly Authored<Idiom>[];
  readonly synonymRows: readonly Authored<SynonymRow>[];
  readonly tips: readonly Authored<Tip>[];
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
  const folder = editionFiles(editionDir);
  const errors: BuildError[] = [];

  /** What a file holds, or undefined when it is wrong; its problems join the errors. */
  function readOrCollect<T>(read: () => T): T | undefined {
    try {
      return read();
    } catch (error) {
      if (!(error instanceof EditionFolderError)) throw error;
      errors.push(...error.errors);
      return undefined;
    }
  }

  const config = readOrCollect(() => folder.read('config'));
  const manifest = readOrCollect(() => folder.read('manifest'));
  const { words, corrections, idioms, synonymRows, tips, errors: entryErrors } = folder.entries();
  errors.push(...entryErrors);
  const targets = readOrCollect(() => folder.readIfPresent('targets') ?? {});
  const registry = readOrCollect(() =>
    registryRequired ? folder.read('idRegistry') : (folder.readIfPresent('idRegistry') ?? []),
  );
  if (config !== undefined) {
    errors.push(
      ...checkContent(config, words, corrections, idioms),
      ...checkSynonymRows(config, words, synonymRows),
    );
  }
  if (registry !== undefined) {
    errors.push(
      ...missingEntryErrors(
        registry,
        (id) => folder.entryFile(id),
        (file) => existsSync(join(editionDir, file)),
      ),
    );
  }

  const source = {
    errors,
    words,
    corrections,
    idioms,
    synonymRows,
    tips,
    ...(config === undefined ? {} : { editionId: config.id }),
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
    correctionCategories: config.correctionCategories,
    words: sortedById(words),
    corrections: sortedById(corrections),
    idioms: sortedById(idioms),
    synonymRows: sortedById(synonymRows),
    tips: sortedById(tips),
  };
  return { ...source, valid: { content, manifest, targets } };
}

function sortedById<T extends Entry>(authored: readonly Authored<T>[]): T[] {
  return authored.map(({ entry }) => entry).toSorted((a, b) => compare(a.id, b.id));
}

/** Code-unit order, independent of the machine's locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
