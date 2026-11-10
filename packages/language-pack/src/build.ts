import type { PackMetadata } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checkContentVersion } from './content-manifest';
import { missedTargets, type MissedTarget } from './content-targets';
import { unregisteredEntries } from './id-registry';
import { PACK_FORMAT, type PackContent } from './pack-layout';
import { readEdition, readEditionWithSnapshot } from './read-edition';
import type { MissingRecordings } from './recordings';
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
      /** The counts, Retired Words and Retired Corrections left out (ADR 0009). */
      readonly report: ContentReport;
      /** The content targets the Edition declares and the content misses. */
      readonly missedTargets: readonly MissedTarget[];
      /** How many Words each Narrator Voice has no Recording of (ADR 0083). */
      readonly missingRecordings: readonly MissingRecordings[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

export type CheckResult =
  | {
      readonly ok: true;
      /** The content targets the Edition declares and the content misses. */
      readonly missedTargets: readonly MissedTarget[];
      /** For each Narrator Voice, how many Words it has no Recording of (ADR 0083). */
      readonly missingRecordings: readonly MissingRecordings[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Checks an Edition's content with the build's own rules and writes nothing:
 * it refuses exactly what `buildLanguagePack` refuses, and reports the
 * content targets the content misses.
 */
export function checkLanguagePack({
  editionDir,
  today = new Date(),
}: {
  editionDir: string;
  /** The day the public domain is judged on (ADR 0045). */
  today?: Date;
}): CheckResult {
  const checked = checkEdition(editionDir, today);
  if (!checked.ok) return checked;
  const { missedTargets, missingRecordings } = checked;
  return { ok: true, missedTargets, missingRecordings };
}

/**
 * Validates an Edition's config and content, Entry by Entry, across Entries
 * and against the id registry and the content manifest, and compiles them
 * into a SQLite Language Pack at `outFile` with a content report, checked
 * against the content targets the Edition declares. It refuses a literary use
 * not yet in the public domain on `today`. Nothing is written when
 * there are errors; missed targets are not errors.
 */
export function buildLanguagePack({
  editionDir,
  outFile,
  today = new Date(),
}: {
  editionDir: string;
  outFile: string;
  /** The day the public domain is judged on (ADR 0045). */
  today?: Date;
}): BuildResult {
  const checked = checkEdition(editionDir, today);
  if (!checked.ok) return checked;
  const { content, metadata, report, missedTargets, missingRecordings } = checked;
  writePack(outFile, content, metadata);
  return { ok: true, metadata, report, missedTargets, missingRecordings };
}

/**
 * Compiles a SQLite Language Pack at `outFile` from an Edition's folder,
 * which gives the config, Categories and assets, and a snapshot of the
 * backend, which gives every record, its retired flag and the Words that
 * need a new Recording at the snapshot's content version. It checks the
 * records with the build's own rules and writes nothing when there are
 * errors; missed targets are not errors.
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
  /** The day the public domain is judged on (ADR 0045). */
  today?: Date;
}): BuildResult {
  const source = readEditionWithSnapshot(editionDir, snapshot, { today });
  if (source.errors.length > 0 || source.valid === undefined) {
    return { ok: false, errors: source.errors };
  }
  const { content, targets } = source.valid;
  const metadata: PackMetadata = {
    editionId: content.editionId,
    contentVersion: content.contentVersion,
    contentChecksum: checksumOf(content),
    packFormat: PACK_FORMAT,
  };
  writePack(outFile, content, metadata, snapshot);
  const report = contentReport(content);
  return {
    ok: true,
    metadata,
    report,
    missedTargets: missedTargets(report, targets),
    missingRecordings: source.missingRecordings,
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
  /** The day the public domain is judged on (ADR 0045). */
  today?: Date;
  fetch?: ApiFetch;
}): Promise<BuildResult> {
  const { id: editionId } = editionFiles(editionDir).read('config');
  const snapshot = await fetchSnapshot({
    apiUrl,
    editionId,
    ...(fetch === undefined ? {} : { fetch }),
  });
  return buildFromSnapshot({ editionDir, snapshot, outFile, today });
}

function checkEdition(
  editionDir: string,
  today: Date,
):
  | {
      ok: true;
      content: PackContent;
      metadata: PackMetadata;
      report: ContentReport;
      missedTargets: MissedTarget[];
      missingRecordings: readonly MissingRecordings[];
    }
  | { ok: false; errors: readonly BuildError[] } {
  const source = readEdition(editionDir, { registryRequired: true, today });
  const command = `pnpm build:pack ${source.editionId ?? '<edition-id>'} --record`;
  const unregistered =
    source.registry === undefined
      ? []
      : unregisteredEntries(
          [
            ...source.words,
            ...source.corrections,
            ...source.idioms,
            ...source.synonymRows,
            ...source.tips,
          ],
          source.registry,
        );
  const errors = [
    ...source.errors,
    ...unregistered.map(({ file, entry }) => ({
      file,
      entryId: entry.id,
      field: 'id',
      message: `Not in content/ids.json: record new ids with ${command}`,
    })),
  ];
  if (errors.length > 0 || source.valid === undefined) return { ok: false, errors };

  const { content, manifest, targets } = source.valid;
  const check = checkContentVersion(content, manifest);
  if (!check.recorded) return { ok: false, errors: [check.error] };
  const metadata: PackMetadata = {
    editionId: content.editionId,
    ...check.manifest,
    packFormat: PACK_FORMAT,
  };

  const report = contentReport(content);
  return {
    ok: true,
    content,
    metadata,
    report,
    missedTargets: missedTargets(report, targets),
    missingRecordings: source.missingRecordings,
  };
}
