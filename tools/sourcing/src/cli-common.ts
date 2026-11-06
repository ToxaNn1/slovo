/**
 * What every sourcing command shares: reading the list and opening the
 * Edition, the real fetch and clock, the shared cache, and the summary it
 * prints after the run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EDITIONS_DIR, EditionFolderError, openEdition } from '@slovo/language-pack/edition';

import {
  defaultCacheDir,
  fetchPage,
  systemClock,
  type PipelineOptions,
  type SourcingResult,
} from './index';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const toolDir = fileURLToPath(new URL('../', import.meta.url));

export interface CliInput {
  readonly listFile: string;
  readonly edition: string;
  readonly out: string | undefined;
  readonly cache: string | undefined;
}

export type CliRun =
  | { readonly ok: true; readonly list: string; readonly options: PipelineOptions }
  | { readonly ok: false; readonly exitCode: number };

/** Reads the list and opens the Edition; prints why and gives the exit code when either fails. */
export function prepareRun(input: CliInput): CliRun {
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const listPath = resolve(cwd, input.listFile);
  if (!existsSync(listPath)) {
    console.error(`No Lemma list at ${listPath}`);
    return { ok: false, exitCode: 2 };
  }
  try {
    const edition = openEdition(EDITIONS_DIR, input.edition);
    return {
      ok: true,
      list: readFileSync(listPath, 'utf8'),
      options: {
        edition,
        outDir: input.out === undefined ? join(toolDir, 'review') : resolve(cwd, input.out),
        cacheDir: input.cache === undefined ? defaultCacheDir() : resolve(cwd, input.cache),
        fetch: fetchPage,
        clock: systemClock,
        random: Math.random,
        log: (message) => {
          console.error(message);
        },
      },
    };
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return { ok: false, exitCode: 2 };
  }
}

/** Prints a line per Lemma, the requests made and where the review report is; gives the exit code. */
export function printSummary(result: SourcingResult): number {
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
    `Requests: ${String(requests.network)} to the network, ${String(requests.cached)} from the cache, ${String(requests.backoffs)} back-off(s)`,
  );
  for (const [host, reason] of Object.entries(requests.unreachable)) {
    console.log(`Skipped for this run: ${host} (${reason})`);
  }
  console.log(`Review report: ${displayPath(result.reportFile)}`);
  return 0;
}

/** A path relative to the repo root when it lies inside the repo, absolute otherwise. */
function displayPath(path: string): string {
  const fromRoot = relative(repoRoot, path);
  return fromRoot.startsWith('..') ? path : fromRoot;
}
