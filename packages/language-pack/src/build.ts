import type { BuildError } from './build-error';
import { contentChecksum } from './checksum';
import { unrecordedContentErrors } from './content-manifest';
import { missedTargets, type MissedTarget } from './content-targets';
import { unregisteredEntries } from './id-registry';
import type { PackMetadata } from './pack-layout';
import { readEdition } from './read-edition';
import { contentReport, type ContentReport } from './report';
import { writePack } from './write-pack';

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
 * Validates an Edition's config and content, Entry by Entry, across Entries
 * and against the id registry and the content manifest, and compiles them
 * into a SQLite Language Pack at `outFile` with a content report, checked
 * against the content targets the Edition declares. Nothing is written when
 * there are errors; missed targets are not errors.
 */
export function buildLanguagePack({
  editionDir,
  outFile,
}: {
  editionDir: string;
  outFile: string;
}): BuildResult {
  const source = readEdition(editionDir, { registryRequired: true });
  const command = `pnpm build:pack ${source.editionId ?? '<edition-id>'} --record`;
  const unregistered =
    source.registry === undefined
      ? []
      : unregisteredEntries([...source.words, ...source.corrections], source.registry);
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
  const metadata: PackMetadata = {
    editionId: content.editionId,
    contentVersion: content.contentVersion,
    checksum: contentChecksum(content),
  };
  const unrecorded = unrecordedContentErrors(manifest, metadata.checksum, content.editionId);
  if (unrecorded.length > 0) return { ok: false, errors: unrecorded };

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
