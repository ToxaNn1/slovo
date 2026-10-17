import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Logger } from 'pino';

import * as schema from './schema';

/** The backend's one Postgres pool. */
export interface Database {
  /** Drizzle over the pool, for the adapters. */
  readonly db: NodePgDatabase<typeof schema>;
  /** Resolves when the database answers a query, and rejects when it doesn't. */
  ping(): Promise<void>;
  /** Waits for the queries in flight and closes every connection. */
  close(): Promise<void>;
}

export function createDatabase(url: string, logger: Logger): Database {
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  // An idle connection that breaks (the database restarted) fails no request:
  // the pool drops it and opens a new one when a query needs it.
  pool.on('error', (error) => {
    logger.warn({ err: error }, 'an idle database connection broke');
  });
  return {
    db: drizzle({ client: pool, schema }),
    ping: async () => {
      await pool.query('select 1');
    },
    close: () => pool.end(),
  };
}
