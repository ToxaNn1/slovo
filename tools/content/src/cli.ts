/**
 * The Content CLI: a thin client of the content write API (ADR 0090), with
 * the Агент token of `$SLOVO_AGENT_TOKEN` and the backend at `$SLOVO_API_URL`:
 *
 *   pnpm content add <kind> <array.json | drafts folder> --edition <id>
 *   pnpm content edit <kind> <id> <file.json> --edition <id>
 *   pnpm content retire <kind> <id> --edition <id>
 *   pnpm content flag <kind> <id> --reason <text> --edition <id>
 *   pnpm content have --edition <id> [--kind <kind>]
 *   pnpm content counts --edition <id>
 *   pnpm content check <kind> <array.json | drafts folder> --edition <id>
 *   pnpm content verify <files, ids or folders> | --changed <ref> --edition <id> [--book <file>]
 *   pnpm content import --edition <id> [--override]   (the Edition folder into the backend's Postgres)
 *
 * `add`, `edit`, `retire` and `flag` open one batch per run and print the
 * API's answer for each record (./writes.ts). `have` and `counts` print the
 * content snapshot and the content report (./have.ts). `check` runs the
 * shared content rules on the input locally and sends nothing. `verify`
 * checks quotes against their source pages (./verify.ts). The CLI never
 * writes to the Edition folder; `check` and `verify` read its config.
 * `$SLOVO_EDITIONS_DIR` points the tool at another editions folder, as the
 * tests do.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  EDITIONS_DIR,
  EditionFolderError,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import {
  defaultCacheDir,
  fetchPage,
  POLITE_INTERVAL_MS,
  PoliteClient,
  systemClock,
} from '@slovo/sourcing';

import { apiFromEnv, RECORD_KINDS, recordKind } from './api';
import { counts, have } from './have';
import { verifyEntries } from './verify';
import { add, check, edit, flag, retire, type Io } from './writes';

const KINDS = RECORD_KINDS.join('|');

const USAGE = [
  `Usage: pnpm content add ${KINDS} <array.json | drafts folder> --edition <id>`,
  `       pnpm content edit ${KINDS} <id> <file.json> --edition <id>`,
  `       pnpm content retire ${KINDS} <id> --edition <id>`,
  `       pnpm content flag ${KINDS} <id> --reason <text> --edition <id>`,
  `       pnpm content have --edition <id> [--kind ${KINDS}]`,
  '       pnpm content counts --edition <id>',
  `       pnpm content check ${KINDS} <array.json | drafts folder> --edition <id>`,
  '       pnpm content verify <files, ids or folder> | --changed <ref> --edition <id> [--book <text file>] [--cache <dir>]',
  '       pnpm content import --edition <id> [--override]',
].join('\n');

const terminal: Io = {
  print: (line) => {
    console.log(line);
  },
  problem: (line) => {
    console.error(line);
  },
};

/**
 * Imports the Edition folder into the content tables through the backend's
 * own command, which reads DATABASE_URL and EDITIONS_DIR (ADR 0090): the
 * import is the backend's, the CLI only names it.
 */
function importIntoDatabase(editionId: string, override: boolean): number {
  const args = ['--silent', '--filter', '@slovo/backend', 'import-content', '--edition', editionId];
  const { status } = spawnSync('pnpm', override ? [...args, '--override'] : args, {
    stdio: 'inherit',
  });
  return status ?? 1;
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      kind: { type: 'string' },
      reason: { type: 'string' },
      changed: { type: 'string' },
      book: { type: 'string' },
      cache: { type: 'string' },
      override: { type: 'boolean' },
    },
  });
  const [command, ...rest] = positionals;
  const editionId = values.edition;
  if (editionId === undefined) {
    console.error(USAGE);
    return 2;
  }
  if (command === 'import' && rest.length === 0) {
    return importIntoDatabase(editionId, values.override === true);
  }
  if (command === 'verify' && rest.length > 0 !== (values.changed !== undefined)) {
    const edition = openedEdition(editionId);
    if (typeof edition === 'number') return edition;
    const cwd = process.env['INIT_CWD'] ?? process.cwd();
    return verifyEntries({
      edition,
      targets:
        values.changed === undefined
          ? { kind: 'named', names: rest }
          : { kind: 'changed', ref: values.changed },
      bookFile: values.book === undefined ? undefined : resolve(cwd, values.book),
      client: new PoliteClient(
        fetchPage,
        systemClock,
        values.cache === undefined ? defaultCacheDir() : resolve(cwd, values.cache),
        POLITE_INTERVAL_MS,
        (line) => {
          terminal.problem(line);
        },
      ),
      cwd,
      print: (line) => {
        terminal.print(line);
      },
      problem: (line) => {
        terminal.problem(line);
      },
    });
  }
  const [kindName, ...args] = rest;
  const kind = recordKind(kindName);
  const api =
    kind === undefined && !['have', 'counts'].includes(command ?? '')
      ? undefined
      : apiFromEnv((line) => {
          terminal.problem(line);
        });
  if (command === 'have' && rest.length === 0) {
    const only = values.kind === undefined ? undefined : recordKind(values.kind);
    if (values.kind !== undefined && only === undefined) return usage();
    return api === undefined ? 1 : have(api, { editionId, kind: only }, terminal);
  }
  if (command === 'counts' && rest.length === 0) {
    return api === undefined ? 1 : counts(api, { editionId }, terminal);
  }
  if (kind === undefined) return usage();
  const [first, second] = args;
  if (command === 'add' && args.length === 1 && first !== undefined) {
    return api === undefined ? 1 : add(api, { editionId, kind, path: here(first) }, terminal);
  }
  if (command === 'edit' && args.length === 2 && first !== undefined && second !== undefined) {
    return api === undefined
      ? 1
      : edit(api, { editionId, kind, id: first, file: here(second) }, terminal);
  }
  if (command === 'retire' && args.length === 1 && first !== undefined) {
    return api === undefined ? 1 : retire(api, { editionId, kind, id: first }, terminal);
  }
  if (
    command === 'flag' &&
    args.length === 1 &&
    first !== undefined &&
    values.reason !== undefined
  ) {
    const reason = values.reason;
    return api === undefined ? 1 : flag(api, { editionId, kind, id: first, reason }, terminal);
  }
  if (command === 'check' && args.length === 1 && first !== undefined) {
    const edition = openedEdition(editionId);
    if (typeof edition === 'number') return edition;
    if (api === undefined) return 1;
    const path = here(first);
    const today = new Date();
    return check(api, { editionId, kind, path, config: edition.config, today }, terminal);
  }
  return usage();
}

/** A path the command names, from where it was run. */
function here(path: string): string {
  return resolve(process.env['INIT_CWD'] ?? process.cwd(), path);
}

function usage(): number {
  console.error(USAGE);
  return 2;
}

/** The Edition folder, read only; the exit code when it does not open. */
function openedEdition(editionId: string): EditionFolder | number {
  try {
    return openEdition(process.env['SLOVO_EDITIONS_DIR'] ?? EDITIONS_DIR, editionId);
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return error.reason === 'unknown' ? 2 : 1;
  }
}

process.exitCode = await main();
