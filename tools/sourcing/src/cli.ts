/**
 * Drafts Words for a list of Lemmas, for human review:
 *
 *   pnpm source:words <lemma-list> --edition <id> [--snapshot <file>] [--out <dir>] [--cache <dir>]
 *                     [--sum auto|direct|wayback|off]
 *
 * The list has one Lemma per line, `<lemma> <category id> <rarity>`, with
 * `#` comments. Drafts, incomplete drafts and `review-report.md` go to the
 * `words/` folder of the review folder, `tools/sourcing/review/` (git-ignored). Fetched pages go to one cache shared by every worktree and
 * run on the machine: `--cache`, else `$SLOVO_SOURCING_CACHE`, else
 * `$XDG_CACHE_HOME/slovo-sourcing` or `~/.cache/slovo-sourcing`. goroh.pp.ua
 * is the main source; sum.in.ua and the Wayback Machine are fallbacks for
 * Definitions, each tried once per run (`--sum off` skips them).
 */
import { parseArgs } from 'node:util';

import { prepareRun, printSummary } from './cli-common';
import { sourceWords, type SumAccess } from './index';

const USAGE =
  'Usage: pnpm source:words <lemma-list> --edition <id> [--snapshot <file>] [--out <dir>] [--cache <dir>] [--sum auto|direct|wayback|off]';
const SUM_ACCESS: readonly SumAccess[] = ['auto', 'direct', 'wayback', 'off'];

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      out: { type: 'string' },
      cache: { type: 'string' },
      snapshot: { type: 'string' },
      sum: { type: 'string', default: 'auto' },
    },
  });
  const [listFile] = positionals;
  const sumAccess = SUM_ACCESS.find((access) => access === values.sum);
  const { edition } = values;
  if (
    listFile === undefined ||
    positionals.length > 1 ||
    edition === undefined ||
    sumAccess === undefined
  ) {
    console.error(USAGE);
    return 2;
  }
  const run = await prepareRun({
    listFile,
    edition,
    out: values.out,
    cache: values.cache,
    snapshot: values.snapshot,
    apiUrl: process.env['SLOVO_API_URL'],
  });
  if (!run.ok) return run.exitCode;
  return printSummary(await sourceWords({ ...run.options, lemmaList: run.list, sumAccess }));
}

process.exitCode = await main();
