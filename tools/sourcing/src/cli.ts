/**
 * Drafts Words for a list of Lemmas, for human review:
 *
 *   pnpm source:words <lemma-list> --edition <id> [--snapshot <file>] [--out <dir>] [--cache <dir>]
 *                     [--sum off|auto|direct|wayback]
 *
 * The list has one Lemma per line, `<lemma> <category id> <rarity>`, with
 * `#` comments. Drafts, incomplete drafts and `review-report.md` go to the
 * `words/` folder of the review folder, `tools/sourcing/review/` (git-ignored). Fetched pages go to one cache shared by every worktree and
 * run on the machine: `--cache`, else `$SLOVO_SOURCING_CACHE`, else
 * `$XDG_CACHE_HOME/slovo-sourcing` or `~/.cache/slovo-sourcing`. goroh.pp.ua
 * is the source; sum.in.ua and the Wayback Machine are asked for Definitions
 * only with `--sum auto|direct|wayback`, each tried once per run. A Lemma whose
 * only article points at another is followed one step, judged by `wordfreq`.
 * A Lemma no explanatory dictionary has is drafted from Грінченко, once
 * `pnpm source:hrinchenko` has built its index, else from ЕСУМ's gloss, both
 * flagged `write-fresh`.
 */
import { parseArgs } from 'node:util';

import { prepareRun, printSummary } from './cli-common';
import { cachedHrinchenko } from './hrinchenko';
import { sourceWords, type SumAccess } from './index';
import { loadWordfreq } from './lemma-sources';
import { fetchBytes } from './node-ports';
import { zipfOf } from './wordfreq';

const USAGE =
  'Usage: pnpm source:words <lemma-list> --edition <id> [--snapshot <file>] [--out <dir>] [--cache <dir>] [--sum off|auto|direct|wayback]';
const SUM_ACCESS: readonly SumAccess[] = ['auto', 'direct', 'wayback', 'off'];

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      out: { type: 'string' },
      cache: { type: 'string' },
      snapshot: { type: 'string' },
      sum: { type: 'string', default: 'off' },
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
  // Грінченко's index, once `pnpm source:hrinchenko` has built it (ADR 0207).
  const hrinchenko = cachedHrinchenko(run.options.cacheDir) ?? new Map();
  const frequencies = await loadWordfreq({
    cacheDir: run.options.cacheDir,
    download: fetchBytes,
    log: (message) => {
      console.error(message);
    },
  });
  return printSummary(
    await sourceWords({
      ...run.options,
      lemmaList: run.list,
      sumAccess,
      hrinchenko,
      zipf: (lemma) => zipfOf(frequencies, lemma),
    }),
  );
}

process.exitCode = await main();
