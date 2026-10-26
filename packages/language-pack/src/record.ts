import { existsSync, writeFileSync } from 'node:fs';

import type { BuildError } from './build-error';
import { checkContentVersion } from './content-manifest';
import { editionFiles } from './edition-folder';
import { ID_REGISTRY_FILE, unregisteredEntries } from './id-registry';
import { compare, readEdition } from './read-edition';

export type RecordResult =
  | {
      readonly ok: true;
      readonly previousContentVersion: number;
      readonly contentVersion: number;
      readonly contentChecksum: string;
      /** The ids added to the end of the registry, in code-unit order. */
      readonly newIds: readonly string[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Records an Edition's content after an edit, so it builds again: appends
 * the ids of new Entries to the id registry, and when the content changed,
 * raises the content version and records the checksum the pack will have.
 * Known ids are never dropped. It starts a registry only for an Edition never
 * recorded: one recorded before may have shipped ids a new registry would
 * free (ADR 0010). Writes nothing when the content has errors.
 */
export function recordContent({ editionDir }: { editionDir: string }): RecordResult {
  const source = readEdition(editionDir, { registryRequired: false });
  if (source.errors.length > 0 || source.valid === undefined || source.registry === undefined) {
    return { ok: false, errors: source.errors };
  }
  const { registry } = source;

  const { content, manifest } = source.valid;
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
  const check = checkContentVersion(content, manifest);
  if (!check.recorded) writeJson(folder.path('manifest'), check.next);
  const recorded = check.recorded ? check.manifest : check.next;
  if (newIds.length > 0) {
    writeJson(folder.path('idRegistry'), [...registry, ...newIds]);
  }
  return {
    ok: true,
    previousContentVersion: manifest.contentVersion,
    contentVersion: recorded.contentVersion,
    contentChecksum: recorded.contentChecksum,
    newIds,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
