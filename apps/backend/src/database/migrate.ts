import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Logger } from 'pino';

import { createDatabase } from './database';

/** The migrations drizzle-kit generates from the schema (`pnpm db:generate`). */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Runs every migration the database hasn't run yet, in order. */
export async function migrateDatabase(url: string, logger: Logger): Promise<void> {
  const database = createDatabase(url, logger);
  try {
    await migrate(database.db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await database.close();
  }
}
