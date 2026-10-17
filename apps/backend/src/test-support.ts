import { randomUUID } from 'node:crypto';

import { systemClock } from '@slovo/server-core';
import pg from 'pg';
import { pino } from 'pino';
import { inject } from 'vitest';

import { createApp, type AppDependencies } from './app';
import { createDatabase } from './database/database';
import { migrateDatabase } from './database/migrate';

/** The Postgres of the repo's `compose.yaml`, which the tests use unless `DATABASE_URL` names another. */
const LOCAL_DATABASE_URL = 'postgres://slovo:slovo@localhost:55432/slovo';

/** A logger that writes nothing, for tests that don't read the logs. */
export const silentLogger = pino({ enabled: false });

/** The Postgres server the tests make their databases on. */
export function testDatabaseServer(): string {
  return process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL;
}

export interface TestDatabase {
  /** The URL of the new database. */
  readonly url: string;
  drop(): Promise<void>;
}

/**
 * Makes a database with a random name on the server `serverUrl` names and
 * runs the migrations on it, so a test run never meets another run's data.
 */
export async function createTestDatabase(serverUrl: string): Promise<TestDatabase> {
  const name = `slovo_test_${randomUUID().replaceAll('-', '')}`;
  await onServer(serverUrl, `CREATE DATABASE ${name}`);
  const drop = () => onServer(serverUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  try {
    await migrateDatabase(url.href, silentLogger);
  } catch (error) {
    await drop();
    throw error;
  }
  return { url: url.href, drop };
}

async function onServer(serverUrl: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: serverUrl, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `Postgres is not reachable at ${new URL(serverUrl).host}. ` +
        'Start Docker Desktop, then run `docker compose up --detach --wait` from the repo root.',
      { cause },
    );
  }
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

/**
 * The backend built by its composition root on this run's database, with a
 * silent logger and the system clock unless the test gives its own. Requests
 * go to the app in process (`app.request`), so no port is opened.
 */
export function testApp(dependencies: Partial<AppDependencies> = {}) {
  const database = dependencies.database ?? createDatabase(inject('databaseUrl'), silentLogger);
  const app = createApp({ database, clock: systemClock, logger: silentLogger, ...dependencies });
  return { app, close: () => database.close() };
}
