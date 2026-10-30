import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Logger } from 'pino';
import { z } from 'zod';

import { createDatabase, type Database } from './database';

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

/** The migrations in order, as drizzle-kit's journal lists them: each by its name and the time it was made. */
const JOURNAL = z
  .object({ entries: z.array(z.object({ tag: z.string(), when: z.number() })).nonempty() })
  .parse(JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')));

/**
 * How far the database has migrated: the name of the last migration it ran
 * (null for none), and whether one waits.
 */
export type MigrationState =
  | { readonly status: 'migrated'; readonly last: string }
  | { readonly status: 'pending'; readonly last: string | null };

/** Postgres's code for a table that does not exist. */
const UNDEFINED_TABLE = '42P01';

/**
 * Reads how far the database has migrated, from the table where drizzle's
 * migrator records the time of each migration it runs, which the first run
 * makes; rejects when the database doesn't answer.
 */
export async function migrationState(database: Database): Promise<MigrationState> {
  const ran = await database.db
    .execute<{ ran: string | null }>(
      sql`select max(created_at)::text as ran from drizzle.__drizzle_migrations`,
    )
    .then(({ rows }) => Number(rows[0]?.ran ?? -1))
    .catch((error: unknown) => {
      if (isUndefinedTable(error)) return -1;
      throw error;
    });
  const last = JOURNAL.entries.findLast((entry) => entry.when <= ran)?.tag ?? null;
  const newest = JOURNAL.entries[JOURNAL.entries.length - 1];
  if (last !== null && last === newest?.tag) return { status: 'migrated', last };
  return { status: 'pending', last };
}

/** Whether the query failed on a table that does not exist; drizzle keeps Postgres's error as the cause. */
function isUndefinedTable(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return z.object({ code: z.literal(UNDEFINED_TABLE) }).safeParse(cause ?? error).success;
}
