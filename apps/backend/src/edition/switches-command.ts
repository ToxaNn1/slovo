// `pnpm switches off <edition-id> <feature> --reason <text>`: the Kill switch
// from a shell, for when the admin is down (ADR 0089). It turns the feature
// off over every Rule of the Edition on the database DATABASE_URL names and
// appends an Action log row by the server command, like an admin write.
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { systemClock, type EditionRegistry } from '@slovo/server-core';

import type { CommandOutput } from '../admin/admin-command';
import { ownerAlertsOf } from '../alerts/owner-chat';
import { PublishConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { readEditions } from './edition-folders';
import { createEditions } from './editions';

const USAGE = 'Usage: pnpm switches off <edition-id> <feature> --reason <text>';

/** Runs `switches` on `args`; answers its exit code. */
export async function runSwitchesCommand(
  args: readonly string[],
  editions: EditionRegistry,
  { out, err }: CommandOutput,
): Promise<number> {
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: false,
    options: { reason: { type: 'string' } },
  });
  const [verb, editionId, feature, ...rest] = positionals;
  const reason = typeof values.reason === 'string' ? values.reason.trim() : '';
  if (
    verb !== 'off' ||
    editionId === undefined ||
    feature === undefined ||
    rest.length > 0 ||
    reason === ''
  ) {
    err(USAGE);
    return 2;
  }
  const killed = await editions.kill(feature, editionId, {
    who: { kind: 'command', command: 'switches off' },
    reason,
  });
  if (!killed.ok) {
    err(`"${feature}" of "${editionId}" not turned off: ${killed.reason} (${killed.feature})`);
    return 1;
  }
  out(`Turned "${feature}" off for every reader of "${editionId}"`);
  return 0;
}

async function main(): Promise<number> {
  const { DATABASE_URL, EDITIONS_DIR, ...telegram } = readConfig(PublishConfigSchema, process.env);
  const logger = createLogger();
  const database = createDatabase(DATABASE_URL, logger);
  try {
    const editions = createEditions({
      database,
      clock: systemClock,
      alerts: ownerAlertsOf(database, telegram, logger),
      editions: readEditions(EDITIONS_DIR),
    });
    return await runSwitchesCommand(process.argv.slice(2), editions, {
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
