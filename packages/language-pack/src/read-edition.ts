import type { EditionConfig } from '@slovo/contracts';
import type { ContentSnapshot } from '@slovo/contracts/api';

import { checkContentSet, type Authored } from '@slovo/content-rules';

import { buildErrorsOf, type BuildError } from './build-error';
import { categoryArtErrors } from './category-art';
import { editionFiles, EditionFolderError, SNAPSHOT_FILE, snapshotEntries } from './edition-folder';
import { sampleWordErrors } from './recordings';
import type { PackContent } from './pack-layout';
import { editionFontErrors } from './edition-fonts';

/** The content a snapshot gives the build, with the config from the Edition's folder. */
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
 * Reads an Edition's config, Categories and assets from its folder and takes
 * the records from a snapshot of the backend, checking them Entry by Entry
 * and across Entries. The snapshot carries the ids and the content version.
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
  const { errors, editionId, checked } = readWith(editionDir, today, snapshot);
  if (editionId !== undefined && editionId !== snapshot.editionId) {
    const message = `The snapshot is of Edition ${snapshot.editionId}, not ${editionId}`;
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

function readWith(
  editionDir: string,
  today: Date,
  snapshot: ContentSnapshot,
): {
  errors: BuildError[];
  /** The Edition id, when the config could be read. */
  editionId?: string;
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
  const { words, corrections, idioms, synonymRows, tips, curatedCollections } =
    snapshotEntries(snapshot);
  const crosswordDays = snapshot.crosswordDays.length === 0 ? undefined : snapshot.crosswordDays;
  const tokens = readOrCollect(() => folder.readIfPresent('tokens'));
  const decor = readOrCollect(() => folder.readIfPresent('decor'));
  const wordIds = new Set(words.map(({ entry }) => entry.id));
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
          },
          { today },
        ),
      ),
      ...editionFontErrors(config, tokens, folder.fonts()),
      ...categoryArtErrors(config, decor),
      ...sampleWordErrors(config, (id) => wordIds.has(id)),
    );
  }

  const read = { errors, ...(config === undefined ? {} : { editionId: config.id }) };
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
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
