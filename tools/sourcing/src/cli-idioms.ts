/**
 * Drafts Idioms from goroh «Фразеологія» for a list of Lemmas, for human review:
 *
 *   pnpm source:idioms <idiom-list> --edition <id> [--out <dir>] [--cache <dir>]
 *
 * The list has one Lemma per line, `<lemma> [idiom|proverb]` (`idiom` when
 * left out), with `#` comments. Drafts, incomplete drafts and
 * `review-report.md` go to the `idioms/` folder of the review folder,
 * `tools/sourcing/review/` (git-ignored); fetched pages go to the cache
 * `source:words` uses.
 */
import { parseArgs } from 'node:util';

import { prepareRun, printSummary } from './cli-common';
import { sourceIdioms } from './index';

const USAGE = 'Usage: pnpm source:idioms <idiom-list> --edition <id> [--out <dir>] [--cache <dir>]';

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
  return printSummary(await sourceIdioms({ ...run.options, idiomList: run.list }));
}

process.exitCode = await main();
