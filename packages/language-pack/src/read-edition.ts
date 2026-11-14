import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Correction,
  CuratedCollection,
  EditionConfig,
  Idiom,
  SynonymRow,
  Tip,
  Word,
} from '@slovo/contracts';
import { WordIdSchema } from '@slovo/contracts';
import type { ContentSnapshot } from '@slovo/contracts/api';

import { checkContentSet, checksumOf, type Authored } from '@slovo/content-rules';

import { buildErrorsOf, type BuildError } from './build-error';
import { categoryArtErrors } from './category-art';
import type { ContentManifest } from './content-manifest';
import { editionFiles, EditionFolderError, SNAPSHOT_FILE, snapshotEntries } from './edition-folder';
import { sampleWordErrors } from './recordings';
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
  /** The known ids: none when the registry is optional and missing, unset when it can't be read. */
  readonly registry?: readonly string[];
  /** Set when there are no errors. */
  readonly valid?: {
    /** The content at the version the manifest records. */
    readonly content: PackContent;
    readonly manifest: ContentManifest;
  };
}

/** The part of the content a snapshot gives the build, everything else coming from the folder. */
export interface SnapshotSource {
  readonly errors: readonly BuildError[];
  /** Set when there are no errors. */
  readonly valid?: {
    /** The content at the snapshot's content version. */
    readonly content: PackContent;
    /** The Edition's config, read once for the whole build. */
    readonly config: EditionConfig;
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
  const { source, manifest, checked } = readWith(editionDir, today, {
    from: 'folder',
    registryRequired,
  });
  if (checked === undefined || manifest === undefined) return source;
  const content = { ...checked.content, contentVersion: manifest.contentVersion };
  return { ...source, valid: { content, manifest } };
}

/**
 * Reads an Edition's config, Categories and assets from its folder and takes
 * the records from a snapshot of the backend, checking them as `readEdition`
 * checks the folder's. The folder's content files, id registry and manifest
 * are not read: the snapshot carries the ids and the content version.
 */
export function readEditionWithSnapshot(
  editionDir: string,
  snapshot: ContentSnapshot,
  {
    today,
  }: {
    /** The day the public domain is judged on (ADR 0045). */
    today: Date;
  },
): SnapshotSource {
  const { source, checked } = readWith(editionDir, today, { from: 'snapshot', snapshot });
  const { errors } = source;
  if (source.editionId !== undefined && source.editionId !== snapshot.editionId) {
    const message = `The snapshot is of Edition ${snapshot.editionId}, not ${source.editionId}`;
    return { errors: [...errors, { file: SNAPSHOT_FILE, message }] };
  }
  if (checked === undefined) return { errors };
  const content: PackContent = {
    ...checked.content,
    contentVersion: snapshot.contentVersion,
    ...(snapshot.needsNewRecording.length === 0
      ? {}
      : { needsNewRecording: snapshot.needsNewRecording }),
  };
  return { errors, valid: { content, config: checked.config } };
}

/** Where the records come from: the Edition folder's content files or a snapshot of the backend. */
type RecordsFrom =
  | { readonly from: 'folder'; readonly registryRequired: boolean }
  | { readonly from: 'snapshot'; readonly snapshot: ContentSnapshot };

function readWith(
  editionDir: string,
  today: Date,
  records: RecordsFrom,
): {
  source: EditionSource;
  manifest?: ContentManifest;
  /** Set when there are no errors. */
  checked?: {
    content: Omit<PackContent, 'contentVersion'>;
    config: EditionConfig;
  };
} {
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
  const fromFolder = records.from === 'folder';
  const manifest = fromFolder ? readOrCollect(() => folder.read('manifest')) : undefined;
  const {
    words,
    corrections,
    idioms,
    synonymRows,
    tips,
    curatedCollections,
    errors: entryErrors,
  } = fromFolder ? folder.entries() : snapshotEntries(records.snapshot);
  errors.push(...entryErrors);
  const crosswordDays = fromFolder
    ? readOrCollect(() => folder.readIfPresent('crosswordDays'))
    : records.snapshot.crosswordDays.length === 0
      ? undefined
      : records.snapshot.crosswordDays;
  const tokens = readOrCollect(() => folder.readIfPresent('tokens'));
  const decor = readOrCollect(() => folder.readIfPresent('decor'));
  const registry = fromFolder
    ? readOrCollect(() =>
        records.registryRequired
          ? folder.read('idRegistry')
          : (folder.readIfPresent('idRegistry') ?? []),
      )
    : undefined;
  // The folder's days are held to the manifest; a snapshot's days are the backend's, which keeps them.
  const recordedCrosswordDaysChecksum = fromFolder
    ? manifest?.crosswordDaysChecksum
    : crosswordDays === undefined
      ? undefined
      : checksumOf(crosswordDays);
  const wordIds = new Set(words.map(({ entry }) => entry.id));
  /** Whether the Edition has a Word of this id: a valid one, or a Word file that fails its checks. */
  const isWord = (id: string) =>
    wordIds.has(id) ||
    (fromFolder &&
      WordIdSchema.safeParse(id).success &&
      existsSync(join(editionDir, folder.entryFile(id))));
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
            ...(recordedCrosswordDaysChecksum === undefined
              ? {}
              : { recordedCrosswordDaysChecksum }),
          },
          { today },
        ),
      ),
      ...editionFontErrors(config, tokens, folder.fonts()),
      ...categoryArtErrors(config, decor),
      ...sampleWordErrors(config, isWord),
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
    curatedCollections,
    ...(config === undefined ? {} : { editionId: config.id }),
    ...(registry === undefined ? {} : { registry }),
  };
  const read = { source, ...(manifest === undefined ? {} : { manifest }) };
  if (errors.length > 0 || config === undefined) return read;
  const content = {
    editionId: config.id,
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
  return { ...read, checked: { content, config } };
}

function sortedById<T extends { readonly id: string }>(authored: readonly Authored<T>[]): T[] {
  return authored.map(({ entry }) => entry).toSorted((a, b) => compare(a.id, b.id));
}

/** Code-unit order, independent of the machine's locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
