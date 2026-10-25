import type { PackMetadata } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checkContentVersion } from './content-manifest';
import { missedTargets, type MissedTarget } from './content-targets';
import { unregisteredEntries } from './id-registry';
import { PACK_FORMAT, type PackContent } from './pack-layout';
import { readEdition } from './read-edition';
import { contentReport, type ContentReport } from './report';
import { writePack } from './write-pack';

export type BuildResult =
  | {
      readonly ok: true;
      readonly metadata: PackMetadata;
      /** The counts, Retired Words and Retired Corrections left out (ADR 0009). */
      readonly report: ContentReport;
      /** The content targets the Edition declares and the content misses. */
      readonly missedTargets: readonly MissedTarget[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

export type CheckResult =
  | {
      readonly ok: true;
      /** The content targets the Edition declares and the content misses. */
      readonly missedTargets: readonly MissedTarget[];
    }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * Checks an Edition's content with the build's own rules and writes nothing:
 * it refuses exactly what `buildLanguagePack` refuses, and reports the
 * content targets the content misses.
 */
export function checkLanguagePack({ editionDir }: { editionDir: string }): CheckResult {
  const checked = checkEdition(editionDir);
  if (!checked.ok) return checked;
  return { ok: true, missedTargets: checked.missedTargets };
}

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
  const checked = checkEdition(editionDir);
  if (!checked.ok) return checked;
  const { content, metadata, report, missedTargets } = checked;
  writePack(outFile, content, metadata);
  return { ok: true, metadata, report, missedTargets };
}

function checkEdition(editionDir: string):
  | {
      ok: true;
      content: PackContent;
      metadata: PackMetadata;
      report: ContentReport;
      missedTargets: MissedTarget[];
    }
  | { ok: false; errors: readonly BuildError[] } {
  const source = readEdition(editionDir, { registryRequired: true });
  const command = `pnpm build:pack ${source.editionId ?? '<edition-id>'} --record`;
  const unregistered =
    source.registry === undefined
      ? []
      : unregisteredEntries(
          [...source.words, ...source.corrections, ...source.idioms],
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
  return { ok: true, content, metadata, report, missedTargets: missedTargets(report, targets) };
}
