/**
 * Drafts Corrections for a list of non-standard forms, for human review:
 *
 *   pnpm source:corrections <form-list> --edition <id> [--snapshot <file>] [--out <dir>] [--cache <dir>]
 *
 * The list has one form per line, `<non-standard form> <correction type>
 * <category id>`, with `#` comments. Drafts, incomplete drafts and
 * `review-report.md` go to the `corrections/` folder of the review folder,
 * `tools/sourcing/review/` (git-ignored). The source is goroh.pp.ua
 * «Слововживання»; fetched pages go to the cache `source:words` uses.
 */
import { parseArgs } from 'node:util';

import { prepareRun, printSummary } from './cli-common';
import { sourceCorrections } from './index';

const USAGE =
  'Usage: pnpm source:corrections <form-list> --edition <id> [--out <dir>] [--cache <dir>]';

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      out: { type: 'string' },
      cache: { type: 'string' },
      snapshot: { type: 'string' },
    },
  });
  const [listFile] = positionals;
  const { edition } = values;
  if (listFile === undefined || positionals.length > 1 || edition === undefined) {
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
  return printSummary(await sourceCorrections({ ...run.options, formList: run.list }));
}

process.exitCode = await main();
