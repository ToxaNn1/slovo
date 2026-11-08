// `pnpm quote-check`: checks the quotes of every record changed since its last
// check on the database DATABASE_URL names, prints the counts and exits. The
// Railway Cron service runs it hourly (docs/deploy.md).
import { systemClock } from '@slovo/server-core';

import { MigrateConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { createQuoteCheck, type SourcePages } from './quote-check';

/** A source answers one request per host every 2 seconds, as `pnpm content verify` asks. */
const POLITE_INTERVAL_MS = 2000;
const TIMEOUT_MS = 30_000;

/** The sourcing port over the network: polite per host, each request timed out. */
function fetchedPages(): SourcePages {
  const lastAt = new Map<string, number>();
  return {
    async get(url) {
      const host = new URL(url).host;
      const wait = (lastAt.get(host) ?? 0) + POLITE_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastAt.set(host, Date.now());
      const response = await fetch(encodeURI(safeDecode(url)), {
        headers: { 'user-agent': 'SLOVO quote check' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return { status: response.status, body: await response.text() };
    },
  };
}

function safeDecode(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

async function main(): Promise<number> {
  const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const counts = await createQuoteCheck({
      database,
      clock: systemClock,
      pages: fetchedPages(),
    }).run();
    console.log(
      `quote check: ${String(counts.verified)} verified, ${String(counts.failed)} quote not found, ` +
        `${String(counts.unfetched)} left unverified: the page could not be fetched`,
    );
    return 0;
  } catch (error) {
    console.error(`quote check failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
