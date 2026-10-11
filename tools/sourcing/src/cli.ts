/**
 * Drafts Words for a list of Lemmas, for human review:
 *
 *   pnpm source:words <lemma-list> [--edition <id>] [--out <dir>] [--cache <dir>]
 *                     [--sum auto|direct|wayback]
 *
 * The list has one Lemma per line, `<lemma> <category id> <rarity>`, with
 * `#` comments. Drafts and `review-report.md` go to `tools/sourcing/review/`
 * and fetched pages to `tools/sourcing/.cache/` unless told otherwise; both
 * are git-ignored. With `--sum auto` (the default) sum.in.ua is tried first and
 * the Wayback Machine takes over once the site doesn't answer.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { REPORT_FILE, sourceWords, type Fetch, type SumAccess } from './index';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const toolDir = fileURLToPath(new URL('../', import.meta.url));
const USAGE =
  'Usage: pnpm source:words <lemma-list> [--edition <id>] [--out <dir>] [--cache <dir>] [--sum auto|direct|wayback]';
const REQUEST_TIMEOUT_MS = 20_000;
const SUM_ACCESS: readonly SumAccess[] = ['auto', 'direct', 'wayback'];

const fetchPage: Fetch = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'slovo-sourcing/0.1 (dev tool; one request every 2 s)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, body: await response.text() };
};

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string', default: 'uk' },
      out: { type: 'string' },
      cache: { type: 'string' },
      sum: { type: 'string', default: 'auto' },
    },
  });
  const [listFile] = positionals;
  const sumAccess = SUM_ACCESS.find((access) => access === values.sum);
  if (listFile === undefined || positionals.length > 1 || sumAccess === undefined) {
    console.error(USAGE);
    return 2;
  }
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const listPath = resolve(cwd, listFile);
  if (!existsSync(listPath)) {
    console.error(`No Lemma list at ${listPath}`);
    return 2;
  }
  const outDir = values.out === undefined ? join(toolDir, 'review') : resolve(cwd, values.out);

  const result = await sourceWords({
    lemmaList: readFileSync(listPath, 'utf8'),
    editionDir: join(repoRoot, 'editions', values.edition),
    outDir,
    cacheDir: values.cache === undefined ? join(toolDir, '.cache') : resolve(cwd, values.cache),
    fetch: fetchPage,
    clock: {
      now: () => Date.now(),
      sleep: (ms) =>
        new Promise((done) => {
          setTimeout(done, ms);
        }),
    },
    random: Math.random,
    sumAccess,
  });
  if (!result.ok) {
    console.error('Nothing fetched; fix the input first:');
    for (const error of result.errors) console.error(`  ${error}`);
    return 1;
  }

  const { lemmas, requests } = result.report;
  for (const lemma of lemmas) {
    const ready = lemma.drafts.filter((draft) => draft.ready).length;
    const kinds = new Set(
      [...lemma.flags, ...lemma.drafts.flatMap((draft) => draft.flags)].map((flag) => flag.kind),
    );
    console.log(
      `${lemma.lemma}: ${String(lemma.drafts.length)} draft(s), ${String(ready)} ready` +
        (kinds.size > 0 ? `; flags: ${[...kinds].join(', ')}` : ''),
    );
  }
  console.log(
    `Requests: ${String(requests.network)} to the network, ${String(requests.cached)} from the cache`,
  );
  console.log(`Review report: ${displayPath(join(outDir, REPORT_FILE))}`);
  return 0;
}

/** A path relative to the repo root when it lies inside the repo, absolute otherwise. */
function displayPath(path: string): string {
  const fromRoot = relative(repoRoot, path);
  return fromRoot.startsWith('..') ? path : fromRoot;
}

process.exitCode = await main();
