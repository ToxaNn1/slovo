import type { PackMetadata } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { PACK_FORMAT } from './pack-layout';
import { readEditionWithSnapshot } from './read-edition';
import { starterMediaOf, type StarterMediaList } from './starter-media';
import { contentReport, type ContentReport } from './report';
import { fetchSnapshot } from './snapshot-source';
import { checksumOf } from '@slovo/content-rules';
import { editionFiles } from './edition-folder';
import type { ApiFetch, ContentSnapshot } from '@slovo/contracts/api';
import { writePack } from './write-pack';

export type BuildResult =
  | {
      readonly ok: true;
      readonly metadata: PackMetadata;
      /** The counts, Retired Words and Retired Corrections left out. */
      readonly report: ContentReport;
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/** A build from a snapshot, which also gives the Starter Media to bundle (ADR 0099). */
export type SnapshotBuildResult =
  | (Extract<BuildResult, { ok: true }> & { readonly starterMedia: StarterMediaList })
  | Extract<BuildResult, { ok: false }>;

/**
 * Compiles a SQLite Language Pack at `outFile` from an Edition's folder,
 * which gives the config, Categories and assets, and a snapshot of the
 * backend, which gives every record, its retired flag and the Words that
 * need a new Recording at the snapshot's content version. It checks the
 * records with the build's own rules and writes nothing when there are
 * errors.
 */
export function buildFromSnapshot({
  editionDir,
  snapshot,
  outFile,
  today = new Date(),
}: {
  editionDir: string;
  snapshot: ContentSnapshot;
  outFile: string;
  /** The day the public domain is judged on. */
  today?: Date;
}): SnapshotBuildResult {
  const source = readEditionWithSnapshot(editionDir, snapshot, { today });
  if (source.errors.length > 0 || source.valid === undefined) {
    return { ok: false, errors: source.errors };
  }
  const { content, config } = source.valid;
  const metadata: PackMetadata = {
    editionId: content.editionId,
    contentVersion: content.contentVersion,
    contentChecksum: checksumOf(content),
    packFormat: PACK_FORMAT,
  };
  writePack(outFile, content, metadata, snapshot);
  return {
    ok: true,
    metadata,
    report: contentReport(content),
    starterMedia: starterMediaOf(config, snapshot),
  };
}

/**
 * Fetches the Edition's snapshot from the backend at `apiUrl` and compiles it
 * with `buildFromSnapshot`. Throws a SnapshotUnreachableError, writing no
 * pack, when the backend gives no snapshot.
 */
export async function buildFromBackend({
  editionDir,
  apiUrl,
  outFile,
  today = new Date(),
  fetch,
}: {
  editionDir: string;
  apiUrl: string;
  outFile: string;
  /** The day the public domain is judged on. */
  today?: Date;
  fetch?: ApiFetch;
}): Promise<SnapshotBuildResult> {
  const { id: editionId } = editionFiles(editionDir).read('config');
  const snapshot = await fetchSnapshot({
    apiUrl,
    editionId,
    ...(fetch === undefined ? {} : { fetch }),
  });
  return buildFromSnapshot({ editionDir, snapshot, outFile, today });
}
