/**
 * Drafts Synonym Rows for a list of dominants, for human review:
 *
 *   pnpm source:synonyms <list> --edition <id> [--out <dir>] [--cache <dir>]
 *
 * The list has one dominant per line, `<dominant>[:<sense number>]`, with `#`
 * comments; the sense number picks one of goroh's synonym articles for the
 * dominant, counted from 1. Drafts, incomplete drafts and `review-report.md`
 * go to the `synonyms/` folder of the review folder, `tools/sourcing/review/`
 * (git-ignored). Fetched pages go to the cache `pnpm source:words` uses.
 */
import { parseArgs } from 'node:util';

import { prepareRun, printSummary } from './cli-common';
import { sourceSynonyms } from './index';

const USAGE = 'Usage: pnpm source:synonyms <list> --edition <id> [--out <dir>] [--cache <dir>]';

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      out: { type: 'string' },
      cache: { type: 'string' },
    },
  });
  const [listFile] = positionals;
  const { edition } = values;
  if (listFile === undefined || positionals.length > 1 || edition === undefined) {
    console.error(USAGE);
    return 2;
  }
  const run = prepareRun({ listFile, edition, out: values.out, cache: values.cache });
  if (!run.ok) return run.exitCode;
  return printSummary(await sourceSynonyms({ ...run.options, list: run.list }));
}

process.exitCode = await main();
