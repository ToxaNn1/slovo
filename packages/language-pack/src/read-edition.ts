import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Correction, CuratedCollection, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';
import { WordIdSchema } from '@slovo/contracts';

import { checkContentSet, type Authored } from '@slovo/content-rules';

import { buildErrorsOf, type BuildError } from './build-error';
import { categoryArtErrors } from './category-art';
import type { ContentManifest } from './content-manifest';
import type { ContentTargets } from './content-targets';
import { editionFiles, EditionFolderError } from './edition-folder';
import { illustrationErrors } from './illustrations';
import { missingRecordings, recordingErrors, type MissingRecordings } from './recordings';
import { missingEntryErrors } from './id-registry';
import type { PackContent } from './pack-layout';
import { editionFontErrors } from './edition-fonts';

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
  readonly curatedCollections: readonly Authored<CuratedCollection>[];
  /** How many Words each Narrator Voice has no Recording of; none when the config can't be read. */
  readonly missingRecordings: readonly MissingRecordings[];
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
  {
    registryRequired,
    today,
  }: {
    registryRequired: boolean;
    /** The day the public domain is judged on (ADR 0045). */
    today: Date;
  },
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
  const {
    words,
    corrections,
    idioms,
    synonymRows,
    tips,
    curatedCollections,
    errors: entryErrors,
  } = folder.entries();
  errors.push(...entryErrors);
  const targets = readOrCollect(() => folder.readIfPresent('targets') ?? {});
  const crosswordDays = readOrCollect(() => folder.readIfPresent('crosswordDays'));
  const tokens = readOrCollect(() => folder.readIfPresent('tokens'));
  const decor = readOrCollect(() => folder.readIfPresent('decor'));
  const registry = readOrCollect(() =>
    registryRequired ? folder.read('idRegistry') : (folder.readIfPresent('idRegistry') ?? []),
  );
  const wordIds = new Set(words.map(({ entry }) => entry.id));
  /** Whether the Edition has a Word of this id: a valid one, or a Word file that fails its checks. */
  const isWord = (id: string) =>
    wordIds.has(id) ||
    (WordIdSchema.safeParse(id).success && existsSync(join(editionDir, folder.entryFile(id))));
  if (config !== undefined) {
    errors.push(
      ...buildErrorsOf(
        checkContentSet(
          config,
          {
            words,
            corrections,
            idioms,
            synonymRows,
            tips,
            curatedCollections,
            ...(crosswordDays === undefined ? {} : { crosswordDays }),
            ...(manifest?.crosswordDaysChecksum === undefined
              ? {}
              : { recordedCrosswordDaysChecksum: manifest.crosswordDaysChecksum }),
          },
          { today },
        ),
      ),
      ...editionFontErrors(config, tokens, folder.fonts()),
      ...categoryArtErrors(config, decor),
      ...recordingErrors(config, isWord, folder.recordings(), (voice, name) =>
        folder.recording(voice, name),
      ),
    );
  }
  errors.push(...illustrationErrors(words, (name) => folder.illustration(name)));
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
    curatedCollections,
    missingRecordings:
      config === undefined ? [] : missingRecordings(config, words, folder.recordings()),
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
    ...(crosswordDays === undefined ? {} : { crosswordDays }),
    ...(curatedCollections.length === 0
      ? {}
      : { curatedCollections: sortedById(curatedCollections) }),
  };
  return { ...source, valid: { content, manifest, targets } };
}

function sortedById<T extends { readonly id: string }>(authored: readonly Authored<T>[]): T[] {
  return authored.map(({ entry }) => entry).toSorted((a, b) => compare(a.id, b.id));
}

/** Code-unit order, independent of the machine's locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
