// `pnpm reports list [--edition <id>] [--since <YYYY-MM-DD>]`: prints the
// Mistake Reports still to check on the database DATABASE_URL names, newest
// first (ADR 0056). `--since` takes the day from its start in UTC.
// `pnpm reports resolve <id>`: deletes the report of the id once it is checked.
import { parseArgs } from 'node:util';

import { MigrateConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { listReports, type ReportFilter } from './report-list';
import { resolveReport } from './report-resolve';

const USAGE = [
  'Usage: pnpm reports list [--edition <edition-id>] [--since <YYYY-MM-DD>]',
  '       pnpm reports resolve <report-id>',
].join('\n');

/** What the arguments ask the command to do. */
type Request =
  | { readonly command: 'list'; readonly filter: ReportFilter }
  | { readonly command: 'resolve'; readonly id: string };

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

/** The request the arguments make, or undefined when they are not ones the command takes. */
function readRequest([command, ...args]: string[]): Request | undefined {
  if (command === 'resolve') {
    const [id, ...rest] = args;
    return id === undefined || rest.length > 0 ? undefined : { command, id };
  }
  if (command !== 'list') return undefined;
  const filter = listFilter(args);
  return filter === undefined ? undefined : { command, filter };
}

async function main(): Promise<number> {
  const request = readRequest(process.argv.slice(2));
  if (request === undefined) {
    console.error(USAGE);
    return 2;
  }
  const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    if (request.command === 'list') {
      for (const line of await listReports(database, request.filter)) console.log(line);
      return 0;
    }
    const { exitCode, line } = await resolveReport(database, request.id);
    (exitCode === 0 ? console.log : console.error)(line);
    return exitCode;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
