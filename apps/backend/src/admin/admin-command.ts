// `pnpm admin owner add <email>`, `pnpm admin agent add <name>` and
// `pnpm admin agent revoke <name>`: the server commands of the owner admin
// (ADR 0088), run against the database DATABASE_URL names. Each logs itself
// in the Action log as a server command.
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createAdminAccess, systemClock, type AdminAccess } from '@slovo/server-core';

import { MigrateConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { systemRandom } from '../random';
import { createAdminStore, hashToken } from './admin-store';

const USAGE = [
  'Usage: pnpm admin owner add <email>',
  '       pnpm admin agent add <name>',
  '       pnpm admin agent revoke <name>',
].join('\n');

/** What a command prints: `out` for its answer, `err` for a refusal. */
export interface CommandOutput {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/** Runs one admin command on `args`; answers its exit code. */
export async function runAdminCommand(
  args: readonly string[],
  admin: AdminAccess,
  { out, err }: CommandOutput,
): Promise<number> {
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
    const added = await admin.addAgent(value, 'pnpm admin agent add');
    if (!added.ok) {
      err(`The Агент "${value}" has a token already; revoke it or choose another name.`);
      return 1;
    }
    out(`The token of the Агент "${value}", shown this once; keep it secret:`);
    out(added.token);
    return 0;
  }
  if (subject === 'agent' && verb === 'revoke') {
    if (!(await admin.revokeAgent(value, 'pnpm admin agent revoke'))) {
      err(`The Агент "${value}" has no token to revoke.`);
      return 1;
    }
    out(`The token of the Агент "${value}" is revoked.`);
    return 0;
  }
  err(USAGE);
  return 2;
}

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const admin = createAdminAccess({
      store: createAdminStore(database),
      clock: systemClock,
      random: systemRandom,
      hash: hashToken,
    });
    return await runAdminCommand(positionals, admin, {
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
