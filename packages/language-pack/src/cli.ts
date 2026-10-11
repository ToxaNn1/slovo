/**
 * Builds an Edition's Language Pack:
 *
 *   pnpm build:pack <edition-id> [--out <file>]
 *
 * The pack goes to `editions/<edition-id>/dist/language-pack.db` unless
 * `--out` says otherwise. Prints the content report after every successful
 * build. Exits non-zero, listing every error, when the content is invalid,
 * and listing every miss when the content falls short of the Edition's
 * content targets (`content/targets.json`); the pack is still written then.
 */
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildLanguagePack } from './build';
import { formatBuildError } from './build-error';
import { formatContentReport } from './report';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const editionsDir = join(repoRoot, 'editions');

function main(): number {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  });
  const [editionId] = positionals;
  if (editionId === undefined || positionals.length > 1) {
    console.error('Usage: pnpm build:pack <edition-id> [--out <file>]');
    return 2;
  }

  const editionDir = join(editionsDir, editionId);
  if (!/^[a-z][a-z0-9-]*$/.test(editionId) || !existsSync(join(editionDir, 'edition.json'))) {
    console.error(`Unknown Edition "${editionId}": expected editions/${editionId}/edition.json`);
    return 2;
  }
  const outFile =
    values.out === undefined
      ? join(editionDir, 'dist', 'language-pack.db')
      : resolve(process.env['INIT_CWD'] ?? process.cwd(), values.out);

  const result = buildLanguagePack({ editionDir, outFile });
  if (!result.ok) {
    console.error(
      `Language Pack for "${editionId}" not built: ${String(result.errors.length)} error(s)`,
    );
    for (const error of result.errors) console.error(`  ${formatBuildError(error)}`);
    return 1;
  }

  const { metadata, wordCount, correctionCount, report, missedTargets } = result;
  console.log(`Built the Language Pack for "${metadata.editionId}"`);
  console.log(`  file:            ${displayPath(outFile)}`);
  console.log(`  content version: ${String(metadata.contentVersion)}`);
  console.log(`  checksum:        ${metadata.checksum}`);
  console.log(`  Words:           ${String(wordCount)}`);
  console.log(`  Corrections:     ${String(correctionCount)}`);
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
