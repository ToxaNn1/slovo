// `pnpm admin owner add <email>`, `pnpm admin agent add <name>` and
// `pnpm admin agent revoke <name>`, `pnpm admin check add <version> <text>` and
// `pnpm admin check import <file> [--version <v>]`: the server commands of the owner admin
// (ADR 0088), run against the database DATABASE_URL names. Each logs itself
// in the Action log as a server command.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  createAdminAccess,
  createOwnerChecks,
  systemClock,
  type AdminAccess,
  type OwnerChecks,
} from '@slovo/server-core';

import { MigrateConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { systemRandom } from '../random';
import { createAdminStore, hashToken } from './admin-store';
import { createOwnerCheckStore } from './owner-check-store';

const USAGE = [
  'Usage: pnpm admin owner add <email>',
  '       pnpm admin agent add <name>',
  '       pnpm admin agent revoke <name>',
  '       pnpm admin check add <version> <text>',
  '       pnpm admin check import <file> [--version <version>]',
].join('\n');

/** What a command prints: `out` for its answer, `err` for a refusal. */
export interface CommandOutput {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/** What the commands work on; `readFile` reads the file `check import` names. */
export interface CommandDeps {
  readonly admin: AdminAccess;
  readonly ownerChecks: OwnerChecks;
  readonly readFile: (path: string) => Promise<string>;
}

const VERSION = /^\d+\.\d+$/;

/** Runs one admin command on `args`; answers its exit code. */
export async function runAdminCommand(
  args: readonly string[],
  deps: CommandDeps,
  output: CommandOutput,
): Promise<number> {
  if (args[0] === 'check') return runCheckCommand(args.slice(1), deps.ownerChecks, deps, output);
  const { admin } = deps;
  const { out, err } = output;
  const [subject, verb, value, ...rest] = args;
  if (value === undefined || value.trim() === '' || rest.length > 0) {
    err(USAGE);
    return 2;
  }
  if (subject === 'owner' && verb === 'add') {
    if (!value.includes('@')) {
      err(`"${value}" is not an email.`);
      return 2;
    }
    if ((await admin.addOwner(value, 'pnpm admin owner add')) === 'taken') {
      err(`${value} is an Admin user already.`);
      return 1;
    }
    out(`${value} is a Власник. The admin is on.`);
    return 0;
  }
  if (subject === 'agent' && verb === 'add') {
    const added = await admin.addAgent(value, {
      who: { kind: 'command', command: 'pnpm admin agent add' },
      reason: null,
    });
    if (!added.ok) {
      err(`The Агент "${value}" has a token already; revoke it or choose another name.`);
      return 1;
    }
    out(`The token of the Агент "${value}", shown this once; keep it secret:`);
    out(added.token);
    return 0;
  }
  if (subject === 'agent' && verb === 'revoke') {
    if (
      !(await admin.revokeAgent(value, {
        who: { kind: 'command', command: 'pnpm admin agent revoke' },
        reason: null,
      }))
    ) {
      err(`The Агент "${value}" has no token to revoke.`);
      return 1;
    }
    out(`The token of the Агент "${value}" is revoked.`);
    return 0;
  }
  err(USAGE);
  return 2;
}

/** `check add` and `check import`: the Owner checks of a version (ADR 0088). */
async function runCheckCommand(
  args: readonly string[],
  ownerChecks: OwnerChecks,
  { readFile }: CommandDeps,
  { out, err }: CommandOutput,
): Promise<number> {
  const [verb, first, ...rest] = args;
  if (verb === 'add' && first !== undefined && VERSION.test(first)) {
    const text = rest.join(' ').trim();
    if (text === '') {
      err(USAGE);
      return 2;
    }
    const command = 'pnpm admin check add';
    const check = await ownerChecks.add(first, text, { kind: 'command', command });
    out(`Owner check ${String(check.id)} added to ${check.version}.`);
    return 0;
  }
  if (verb === 'import' && first !== undefined) {
    const [flag, version, ...extra] = rest;
    const fallback = flag === '--version' ? version : undefined;
    if (
      (flag !== undefined && (fallback === undefined || !VERSION.test(fallback))) ||
      extra.length > 0
    ) {
      err(USAGE);
      return 2;
    }
    const result = await ownerChecks.import(
      await readFile(first),
      'pnpm admin check import',
      fallback,
    );
    if (result.kind === 'no-version') {
      err(`Line ${String(result.line)} has no version heading above it; pass --version <version>.`);
      return 1;
    }
    if (result.kind === 'not-empty') {
      err('The Owner checks are imported already; add a check with pnpm admin check add.');
      return 1;
    }
    out(`${String(result.count)} Owner checks imported.`);
    return 0;
  }
  err(USAGE);
  return 2;
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { version: { type: 'string' } },
  });
  const args =
    values.version === undefined ? positionals : [...positionals, '--version', values.version];
  const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const admin = createAdminAccess({
      store: createAdminStore(database),
      clock: systemClock,
      random: systemRandom,
      hash: hashToken,
    });
    const ownerChecks = createOwnerChecks({
      store: createOwnerCheckStore(database),
      clock: systemClock,
      admin,
    });
    const deps = { admin, ownerChecks, readFile: (path: string) => readFile(path, 'utf8') };
    return await runAdminCommand(args, deps, {
      out: (line) => {
        console.log(line);
      },
      err: (line) => {
        console.error(line);
      },
    });
  } finally {
    await database.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main();
