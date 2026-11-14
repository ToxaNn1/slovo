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
 *   pnpm content verify <ids or drafts> | --changed <earlier snapshot file> --edition <id> [--snapshot <file>] [--book <file>]
 *   pnpm content import --edition <id> [--snapshot <file>] [--override]   (the Edition folder, or a saved snapshot, into the backend's Postgres)
 *
 * `add`, `edit`, `retire` and `flag` open one batch per run and print the
 * API's answer for each record (./writes.ts). `have` and `counts` print the
 * content snapshot and the content report (./have.ts). `check` runs the
 * shared content rules on the input locally and sends nothing. `verify`
 * checks quotes against their source pages (./verify.ts): the records of the
 * content snapshot (`--snapshot <file>`, else the backend's), or drafts, so a
 * wave verifies them before `add`; drafts alone need no snapshot. The CLI never writes to the Edition folder
 * and reads only its config. `$SLOVO_EDITIONS_DIR` points the tool at another
 * editions folder, as the tests do.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  EDITIONS_DIR,
  EditionFolderError,
  openEdition,
  openEditionWithSnapshot,
  openEditionWithoutRecords,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import type { ContentSnapshot } from '@slovo/contracts/api';
import { readSnapshotFile } from '@slovo/language-pack';
import {
  contentSnapshot,
  defaultCacheDir,
  fetchPage,
  POLITE_INTERVAL_MS,
  PoliteClient,
  systemClock,
} from '@slovo/sourcing';

import { apiFromEnv, RECORD_KINDS, recordKind } from './api';
import { counts, have } from './have';
import { verifyEntries, type VerifyTargets } from './verify';
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
  '       pnpm content verify <ids, drafts or drafts folder> | --changed <earlier snapshot file> --edition <id> [--snapshot <file>] [--book <text file>] [--cache <dir>]',
  '       pnpm content import --edition <id> [--snapshot <file>] [--override]',
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
 * Imports the Edition folder, or a content snapshot saved to a file, into the
 * content tables through the backend's own command, which reads DATABASE_URL
 * and EDITIONS_DIR (ADR 0090): the import is the backend's, the CLI only names it.
 */
function importIntoDatabase(
  editionId: string,
  { override, snapshot }: { override: boolean; snapshot: string | undefined },
): number {
  const args = ['--silent', '--filter', '@slovo/backend', 'import-content', '--edition', editionId];
  // The backend's command runs in its package: name the file from where pnpm ran.
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  if (snapshot !== undefined) args.push('--snapshot', resolve(cwd, snapshot));
  if (override) args.push('--override');
  const { status } = spawnSync('pnpm', args, { stdio: 'inherit' });
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
      snapshot: { type: 'string' },
    },
  });
  const [command, ...rest] = positionals;
  const editionId = values.edition;
  if (editionId === undefined) {
    console.error(USAGE);
    return 2;
  }
  if (command === 'import' && rest.length === 0) {
    return importIntoDatabase(editionId, {
      override: values.override === true,
      snapshot: values.snapshot,
    });
  }
  if (command === 'verify' && rest.length > 0 !== (values.changed !== undefined)) {
    const cwd = process.env['INIT_CWD'] ?? process.cwd();
    // Drafts alone need no records: the Edition opens from its config, with no snapshot.
    const draftsOnly =
      values.changed === undefined && rest.every((name) => existsSync(resolve(cwd, name)));
    const edition = draftsOnly
      ? opened(() =>
          openEditionWithoutRecords(process.env['SLOVO_EDITIONS_DIR'] ?? EDITIONS_DIR, editionId),
        )
      : await editionWithSnapshot(editionId, values.snapshot, cwd);
    if (typeof edition === 'number') return edition;
    const targets = verifyTargets(values.changed, rest, cwd);
    if (targets === null) return 2;
    return verifyEntries({
      edition,
      targets,
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

/** The Edition folder, for its config alone; the exit code when it does not open. */
function openedEdition(editionId: string): EditionFolder | number {
  return opened(() => openEdition(process.env['SLOVO_EDITIONS_DIR'] ?? EDITIONS_DIR, editionId));
}

/**
 * The Edition with the records of its content snapshot: the `--snapshot`
 * file, else the backend's at `$SLOVO_API_URL` (ADR 0090); the exit code when
 * neither gives one or the Edition does not open.
 */
async function editionWithSnapshot(
  editionId: string,
  file: string | undefined,
  cwd: string,
): Promise<EditionFolder | number> {
  const snapshot = await contentSnapshot({
    editionId,
    file: file === undefined ? undefined : resolve(cwd, file),
    apiUrl: process.env['SLOVO_API_URL'],
  });
  if (!snapshot.ok) {
    console.error(snapshot.error);
    return 2;
  }
  return opened(() =>
    openEditionWithSnapshot(
      process.env['SLOVO_EDITIONS_DIR'] ?? EDITIONS_DIR,
      editionId,
      snapshot.snapshot,
    ),
  );
}

/** The Edition `open` opens; the exit code, said why, when it does not open. */
function opened(open: () => EditionFolder): EditionFolder | number {
  try {
    return open();
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return error.reason === 'unknown' ? 2 : 1;
  }
}

/** The Entries `verify` checks: those named, or those changed since an earlier snapshot. */
function verifyTargets(
  changed: string | undefined,
  names: readonly string[],
  cwd: string,
): VerifyTargets | null {
  if (changed === undefined) return { kind: 'named', names };
  const since = earlierSnapshot(changed, cwd);
  return since === null ? null : { kind: 'changed', since, name: changed };
}

/** The earlier snapshot `--changed` names; null, said why, when it is none. */
function earlierSnapshot(file: string, cwd: string): ContentSnapshot | null {
  try {
    return readSnapshotFile(resolve(cwd, file));
  } catch (error) {
    console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

process.exitCode = await main();
