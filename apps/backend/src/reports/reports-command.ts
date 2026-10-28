// `pnpm reports list [--edition <id>] [--since <YYYY-MM-DD>]`: prints the
// Mistake Reports still to check on the database DATABASE_URL names, newest
// first (ADR 0056). `--since` takes the day from its start in UTC.
import { parseArgs } from 'node:util';

import { MigrateConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { listReports, type ReportFilter } from './report-list';

const USAGE = 'Usage: pnpm reports list [--edition <edition-id>] [--since <YYYY-MM-DD>]';

/** The filter the arguments of `list` name, or undefined when they are not the ones it takes. */
function listFilter(args: string[]): ReportFilter | undefined {
  let values: { edition?: string; since?: string };
  try {
    ({ values } = parseArgs({
      args,
      options: { edition: { type: 'string' }, since: { type: 'string' } },
    }));
  } catch {
    return undefined;
  }
  const { edition, since } = values;
  if (since === undefined) return { editionId: edition };
  const day = new Date(since);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(day.getTime())) return undefined;
  return { editionId: edition, since: day };
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  const filter = command === 'list' ? listFilter(args) : undefined;
  if (filter === undefined) {
    console.error(USAGE);
    return 2;
  }
  const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    for (const line of await listReports(database, filter)) console.log(line);
    return 0;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
