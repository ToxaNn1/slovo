/**
 * Builds an Edition's Language Pack:
 *
 *   pnpm build:pack <edition-id> [--record] [--out <file>]
 *
 * The pack goes to `editions/<edition-id>/dist/language-pack.db` unless
 * `--out` says otherwise. Prints the content report after every successful
 * build. Exits non-zero, listing every error, when the content is invalid,
 * and listing every miss when the content falls short of the Edition's
 * content targets (`content/targets.json`); the pack is still written then.
 *
 * After editing the content, `--record` first appends the new ids to the id
 * registry (`content/ids.json`) and, when the content changed, raises the
 * content version in `content/manifest.json`. Without it, a build of
 * unrecorded content fails, so CI catches it.
 */
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildLanguagePack } from './build';
import { formatBuildError } from './build-error';
import {
  EDITIONS_DIR,
  EditionFolderError,
  openEdition,
  type EditionFolder,
} from './edition-folder';
import { recordContent } from './record';
import { formatContentReport } from './report';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function main(): number {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, record: { type: 'boolean' } },
  });
  const [editionId] = positionals;
  if (editionId === undefined || positionals.length > 1) {
    console.error('Usage: pnpm build:pack <edition-id> [--record] [--out <file>]');
    return 2;
  }

  let edition: EditionFolder;
  try {
    edition = openEdition(EDITIONS_DIR, editionId);
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    if (error.reason === 'unknown') {
      console.error(error.message);
      return 2;
    }
    console.error(`Edition "${editionId}" is not valid: ${String(error.errors.length)} error(s)`);
    for (const problem of error.errors) console.error(`  ${formatBuildError(problem)}`);
    return 1;
  }
  const editionDir = edition.dir;
  const outFile =
    values.out === undefined
      ? edition.path('languagePack')
      : resolve(process.env['INIT_CWD'] ?? process.cwd(), values.out);

  if (values.record === true) {
    const recorded = recordContent({ editionDir });
    if (!recorded.ok) {
      console.error(
        `Content of "${editionId}" not recorded: ${String(recorded.errors.length)} error(s)`,
      );
      for (const error of recorded.errors) console.error(`  ${formatBuildError(error)}`);
      return 1;
    }
    const { previousContentVersion, contentVersion, newIds } = recorded;
    console.log(`Recorded the content of "${editionId}"`);
    console.log(
      `  content version: ${String(contentVersion)}${contentVersion === previousContentVersion ? ' (unchanged)' : ` (was ${String(previousContentVersion)})`}`,
    );
    console.log(`  new ids:         ${String(newIds.length)}`);
    console.log('');
  }

  const result = buildLanguagePack({ editionDir, outFile });
  if (!result.ok) {
    console.error(
      `Language Pack for "${editionId}" not built: ${String(result.errors.length)} error(s)`,
    );
    for (const error of result.errors) console.error(`  ${formatBuildError(error)}`);
    return 1;
  }

  const { metadata, report, missedTargets } = result;
  console.log(`Built the Language Pack for "${metadata.editionId}"`);
  console.log(`  file:            ${displayPath(outFile)}`);
  console.log(`  content version: ${String(metadata.contentVersion)}`);
  console.log(`  pack format:     ${String(metadata.packFormat)}`);
  console.log(`  checksum:        ${metadata.contentChecksum}`);
  console.log('');
  console.log(formatContentReport(report));
  console.log('');
  if (missedTargets.length === 0) {
    console.log('Content targets: none missed');
    return 0;
  }
  console.error(`Content targets: ${String(missedTargets.length)} missed`);
  for (const { target, message } of missedTargets) console.error(`  ${target}: ${message}`);
  return 1;
}

/** A path relative to the repo root when it lies inside the repo, absolute otherwise. */
function displayPath(path: string): string {
  const fromRoot = relative(repoRoot, path);
  return fromRoot.startsWith('..') ? path : fromRoot;
}

process.exitCode = main();
