import { writeFileSync } from 'node:fs';

import type { BuildError } from './build-error';
import { contentChecksum } from './checksum';
import type { ContentManifest } from './content-manifest';
import { editionFiles } from './edition-folder';
import { unregisteredEntries } from './id-registry';
import { compare, readEdition } from './read-edition';

export type RecordResult =
  | {
      readonly ok: true;
      readonly previousContentVersion: number;
      readonly contentVersion: number;
      readonly checksum: string;
      /** The ids added to the end of the registry, in code-unit order. */
      readonly newIds: readonly string[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Records an Edition's content after an edit, so it builds again: appends
 * the ids of new Entries to the id registry, which it starts when there is
 * none, and when the content changed, raises the content version and
 * records the checksum the pack will have. Known ids are never dropped.
 * Writes nothing when the content has errors.
 */
export function recordContent({ editionDir }: { editionDir: string }): RecordResult {
  const source = readEdition(editionDir, { registryRequired: false });
  if (source.errors.length > 0 || source.valid === undefined || source.registry === undefined) {
    return { ok: false, errors: source.errors };
  }
  const { registry } = source;

  const { content, manifest } = source.valid;
  const newIds = unregisteredEntries([...source.words, ...source.corrections], registry)
    .map(({ entry }) => entry.id)
    .toSorted(compare);
  const folder = editionFiles(editionDir);
  let recorded: ContentManifest & { checksum: string } = {
    contentVersion: content.contentVersion,
    checksum: contentChecksum(content),
  };
  if (recorded.checksum !== manifest.checksum) {
    const contentVersion = manifest.contentVersion + 1;
    recorded = { contentVersion, checksum: contentChecksum({ ...content, contentVersion }) };
    writeJson(folder.path('manifest'), recorded);
  }
  if (newIds.length > 0) {
    writeJson(folder.path('idRegistry'), [...registry, ...newIds]);
  }
  return {
    ok: true,
    previousContentVersion: manifest.contentVersion,
    contentVersion: recorded.contentVersion,
    checksum: recorded.checksum,
    newIds,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
