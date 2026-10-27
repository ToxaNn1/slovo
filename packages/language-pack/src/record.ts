import { existsSync, writeFileSync } from 'node:fs';

import type { CrosswordDay } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checkContentVersion, type ContentManifest } from './content-manifest';
import { newCrosswordDays } from './crossword';
import { crosswordDaysChecksum } from './crossword-days';
import { editionFiles } from './edition-folder';
import { ID_REGISTRY_FILE, unregisteredEntries } from './id-registry';
import { protectedLiteraryUses } from './public-domain';
import { compare, readEdition } from './read-edition';

export type RecordResult =
  | {
      readonly ok: true;
      readonly previousContentVersion: number;
      readonly contentVersion: number;
      readonly contentChecksum: string;
      /** The ids added to the end of the registry, in code-unit order. */
      readonly newIds: readonly string[];
      /** The dates of the days appended to the crossword days. */
      readonly newCrosswordDays: readonly string[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Records an Edition's content after an edit, so it builds again: appends
 * the ids of new Entries to the id registry, and when the content changed,
 * raises the content version and records the checksum the pack will have.
 * Known ids are never dropped. It starts a registry only for an Edition never
 * recorded: one recorded before may have shipped ids a new registry would
 * free (ADR 0010). Writes nothing when the content has errors, a literary
 * use not yet in the public domain on `today` among them, as the build
 * refuses it. An Edition that keeps crossword days gets new days appended so
 * that 400 lie ahead of `today`, and the manifest records the days as
 * published (ADR 0052).
 */
export function recordContent({
  editionDir,
  today = new Date(),
}: {
  editionDir: string;
  /** The day the public domain is judged on (ADR 0045). */
  today?: Date;
}): RecordResult {
  const source = readEdition(editionDir, { registryRequired: false });
  const errors = [...source.errors, ...protectedLiteraryUses(source.corrections, today)];
  if (errors.length > 0 || source.valid === undefined || source.registry === undefined) {
    return { ok: false, errors };
  }
  const { registry } = source;

  const { manifest } = source.valid;
  let { content } = source.valid;
  const folder = editionFiles(editionDir);
  if (manifest.contentChecksum !== undefined && !existsSync(folder.path('idRegistry'))) {
    return {
      ok: false,
      errors: [
        {
          file: ID_REGISTRY_FILE,
          message:
            'Missing, though the content was recorded before: restore it from git, since a new registry would free the ids of deleted Entries',
        },
      ],
    };
  }
  const newIds = unregisteredEntries(
    [
      ...source.words,
      ...source.corrections,
      ...source.idioms,
      ...source.synonymRows,
      ...source.tips,
    ],
    registry,
  )
    .map(({ entry }) => entry.id)
    .toSorted(compare);
  let newDays: readonly CrosswordDay[] = [];
  if (content.crosswordDays !== undefined) {
    const appended = newCrosswordDays(content, today.toISOString().slice(0, 10));
    if (!appended.ok) return appended;
    newDays = appended.days;
    content = { ...content, crosswordDays: [...content.crosswordDays, ...newDays] };
  }
  const check = checkContentVersion(content, manifest);
  const recorded = check.recorded ? check.manifest : check.next;
  const nextManifest: ContentManifest = {
    ...recorded,
    ...(content.crosswordDays === undefined
      ? {}
      : { crosswordDaysChecksum: crosswordDaysChecksum(content.crosswordDays) }),
  };
  if (newDays.length > 0) writeJson(folder.path('crosswordDays'), content.crosswordDays);
  if (JSON.stringify(nextManifest) !== JSON.stringify(manifest)) {
    writeJson(folder.path('manifest'), nextManifest);
  }
  if (newIds.length > 0) {
    writeJson(folder.path('idRegistry'), [...registry, ...newIds]);
  }
  return {
    ok: true,
    previousContentVersion: manifest.contentVersion,
    contentVersion: recorded.contentVersion,
    contentChecksum: recorded.contentChecksum,
    newIds,
    newCrosswordDays: newDays.map(({ date }) => date),
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
