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

/**
 * The filter the arguments of `list` name; a line saying what is wrong with
 * `--since` when it is no day of the calendar; or undefined when they are not
 * the arguments it takes.
 */
function listFilter(args: string[]): ReportFilter | string | undefined {
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return undefined;
  // Date reads 2026-02-30 as 2 March, so a day counts only when it reads back the same.
  const day = new Date(since);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== since) {
    return `--since ${since} is no day of the calendar.`;
  }
  return { editionId: edition, since: day };
}

/**
 * The request the arguments make; a line saying what is wrong with them; or
 * undefined when they are not ones the command takes.
 */
function readRequest([command, ...args]: string[]): Request | string | undefined {
  if (command === 'resolve') {
    const [id, ...rest] = args;
    return id === undefined || rest.length > 0 ? undefined : { command, id };
  }
  if (command !== 'list') return undefined;
  const filter = listFilter(args);
  return filter === undefined || typeof filter === 'string' ? filter : { command, filter };
}

async function main(): Promise<number> {
  const request = readRequest(process.argv.slice(2));
  if (request === undefined || typeof request === 'string') {
    if (request !== undefined) console.error(request);
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
