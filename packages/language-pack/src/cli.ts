/**
 * Builds an Edition's Language Pack:
 *
 *   pnpm build:pack [<edition-id>] [--snapshot <file>] [--out <file>]
 *   pnpm build:pack [<edition-id>] --record
 *
 * Without an id it builds the pack of the Edition the app bundles, the
 * AppConfig's default Edition (ADR 0065), as every app build does.
 * The Edition folder gives the config, Categories and assets; the records
 * come from the content snapshot of the backend at EXPO_PUBLIC_SLOVO_API_URL,
 * or from a snapshot saved to a file with `--snapshot`. It fails, writing no
 * pack, when the backend gives no snapshot.
 * The pack goes to `editions/<edition-id>/dist/language-pack.db` unless
 * `--out` says otherwise. It downloads the Starter Media the app bundles
 * (ADR 0099) to `editions/<edition-id>/starter-media/`, which git ignores.
 * Prints the content report after every successful build. Exits non-zero, listing every error, when the content is invalid,
 * and listing every miss when the content falls short of the Edition's
 * content targets (`content/targets.json`); the pack is still written then.
 *
 * After editing the content files, `--record` appends the new ids to the id
 * registry (`content/ids.json`) and, when the content changed, raises the
 * content version in `content/manifest.json`, building nothing. For an
 * Edition that keeps crossword days (`content/crossword-days.json`), it also
 * appends days so that 400 lie ahead (ADR 0052).
 */
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildFromBackend, buildFromSnapshot, type SnapshotBuildResult } from './build';
import { formatBuildError } from './build-error';
import {
  EDITIONS_DIR,
  EditionFolderError,
  openAppConfig,
  openEdition,
  REPO_DIR,
  type EditionFolder,
} from './edition-folder';
import { recordContent } from './record';
import { formatContentReport } from './report';
import { readSnapshotFile, SnapshotUnreachableError } from './snapshot-source';
import { downloadStarterMedia, STARTER_MEDIA_DIR } from './starter-media';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const USAGE = [
  'Usage: pnpm build:pack [<edition-id>] [--snapshot <file>] [--out <file>]',
  '       pnpm build:pack [<edition-id>] --record',
].join('\n');

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      record: { type: 'boolean' },
      snapshot: { type: 'string' },
    },
  });
  const recording = values.record === true;
  if (
    positionals.length > 1 ||
    (recording && (values.snapshot !== undefined || values.out !== undefined))
  ) {
    console.error(USAGE);
    return 2;
  }
  const editionId = positionals[0] ?? openAppConfig(REPO_DIR).config.defaultEdition;

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
  const fromCwd = (path: string): string => resolve(process.env['INIT_CWD'] ?? process.cwd(), path);

  if (recording) {
    const recorded = recordContent({ editionDir });
    if (!recorded.ok) {
      console.error(
        `Content of "${editionId}" not recorded: ${String(recorded.errors.length)} error(s)`,
      );
      for (const error of recorded.errors) console.error(`  ${formatBuildError(error)}`);
      return 1;
    }
    const { previousContentVersion, contentVersion, newIds, newCrosswordDays } = recorded;
    console.log(`Recorded the content of "${editionId}"`);
    console.log(
      `  content version: ${String(contentVersion)}${contentVersion === previousContentVersion ? ' (unchanged)' : ` (was ${String(previousContentVersion)})`}`,
    );
    console.log(`  new ids:         ${String(newIds.length)}`);
    console.log(`  crossword days:  ${String(newCrosswordDays.length)} appended`);
    return 0;
  }

  const outFile = values.out === undefined ? edition.path('languagePack') : fromCwd(values.out);
  const apiUrl = process.env['EXPO_PUBLIC_SLOVO_API_URL'];
  let result: SnapshotBuildResult;
  if (values.snapshot !== undefined) {
    const snapshot = readSnapshotFile(fromCwd(values.snapshot));
    result = buildFromSnapshot({ editionDir, snapshot, outFile });
  } else if (apiUrl === undefined || apiUrl === '') {
    console.error(
      'No content snapshot: set EXPO_PUBLIC_SLOVO_API_URL to the backend, or pass --snapshot <file>',
    );
    console.error(USAGE);
    return 2;
  } else {
    try {
      result = await buildFromBackend({ editionDir, apiUrl, outFile });
    } catch (error) {
      if (!(error instanceof SnapshotUnreachableError)) throw error;
      console.error(`Language Pack for "${editionId}" not built: ${error.message}`);
      return 1;
    }
  }
  if (!result.ok) {
    console.error(
      `Language Pack for "${editionId}" not built: ${String(result.errors.length)} error(s)`,
    );
    for (const error of result.errors) console.error(`  ${formatBuildError(error)}`);
    return 1;
  }

  const { metadata, report, missedTargets, starterMedia } = result;
  const starterDir = join(editionDir, STARTER_MEDIA_DIR);
  await downloadStarterMedia(starterMedia, starterDir, async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`);
    return new Uint8Array(await response.arrayBuffer());
  });
  console.log(`Built the Language Pack for "${metadata.editionId}"`);
  console.log(`  file:            ${displayPath(outFile)}`);
  console.log(`  content version: ${String(metadata.contentVersion)}`);
  console.log(`  pack format:     ${String(metadata.packFormat)}`);
  console.log(`  checksum:        ${metadata.contentChecksum}`);
  console.log('');
  console.log(formatContentReport(report));
  console.log('');
  console.log(
    `Starter Media: ${String(starterMedia.files.length)} files in ${displayPath(starterDir)}`,
  );
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

process.exitCode = await main();
