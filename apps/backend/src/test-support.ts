import { randomInt, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { HttpBindings } from '@hono/node-server';
import { createApiClient } from '@slovo/contracts/api';
import type { EditionConfig } from '@slovo/contracts';
import { EDITIONS_DIR, editionFiles, openEdition } from '@slovo/language-pack/edition';
import { systemClock, type Mail, type Mailer } from '@slovo/server-core';
import pg from 'pg';
import { pino } from 'pino';
import { inject, onTestFinished } from 'vitest';

import { createApp, type AppDependencies } from './app';
import { createDatabase } from './database/database';
import { migrateDatabase } from './database/migrate';
import { readEditions } from './edition/edition-folders';

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
 * An editions folder made for one test, with an Edition for each id, each a
 * copy of the Ukrainian Edition's config, strings and content manifest under
 * its own id.
 * `change` changes each config.
 */
export function editionsFolder(
  ids: readonly string[],
  change: (config: EditionConfig) => EditionConfig = (config) => config,
): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const ukrainian = openEdition(EDITIONS_DIR, 'uk');
  for (const id of ids) {
    const edition = editionFiles(join(dir, id));
    mkdirSync(dirname(edition.path('manifest')), { recursive: true });
    copyFileSync(ukrainian.path('strings'), edition.path('strings'));
    copyFileSync(ukrainian.path('manifest'), edition.path('manifest'));
    const config = JSON.parse(readFileSync(ukrainian.path('config'), 'utf8')) as EditionConfig;
    writeFileSync(edition.path('config'), JSON.stringify(change({ ...config, id })));
  }
  return dir;
}

/** A Mailer that keeps every email it is given, so a test reads the Sign-in code. */
export interface FakeMailer extends Mailer {
  /** Every email sent, oldest first. */
  readonly sent: readonly Mail[];
  /** The six digits of the newest email to the address. Throws when none was sent. */
  codeSentTo(email: string): string;
}

export function createFakeMailer(): FakeMailer {
  const sent: Mail[] = [];
  return {
    sent,
    send: (mail) => {
      sent.push(mail);
      return Promise.resolve();
    },
    codeSentTo(email) {
      const code = sent.findLast((mail) => mail.to === email)?.text.match(/\b[0-9]{6}\b/)?.[0];
      if (code === undefined) throw new Error(`no Sign-in code was sent to ${email}`);
      return code;
    },
  };
}

/** The secret the test backends sign their Sessions with. */
const TEST_AUTH_SECRET = 'a-test-secret-that-is-at-least-32-characters';

/** An IP address no other test uses, from the range kept for documentation (RFC 3849). */
export const newIp = () =>
  `2001:db8::${[0, 0, 0].map(() => randomInt(0x10000).toString(16)).join(':')}`;

/**
 * What Node's HTTP server gives the app with a request that came on a
 * connection from the IP address: the part the app reads.
 */
export const connectionFrom = (ip: string) =>
  ({ incoming: { socket: { remoteAddress: ip } } }) as unknown as HttpBindings;

/**
 * The backend built by its composition root on this run's database, with a
 * silent logger, the system clock, the repo's Editions and a fake Mailer
 * unless the test gives its own, and the API's client. Requests go to the app
 * in process (`app.request`, or the client), so no port is opened. The
 * client's requests come from an IP address of their own, so the limits per
 * IP of one test never reach another.
 */
export function testApp(dependencies: Partial<AppDependencies> = {}) {
  const database = dependencies.database ?? createDatabase(inject('databaseUrl'), silentLogger);
  const app = createApp({
    database,
    clock: systemClock,
    logger: silentLogger,
    editions: readEditions(EDITIONS_DIR),
    mailer: createFakeMailer(),
    authSecret: TEST_AUTH_SECRET,
    ...dependencies,
  });
  const ip = newIp();
  // The client the app uses, built from the contract, with its fetch pointed
  // at the app in process.
  const clientWith = (headers: Record<string, string>, from = ip) =>
    createApiClient({
      url: 'http://backend.test',
      fetch: (request) => Promise.resolve(app.fetch(request, connectionFrom(from))),
      headers,
    });
  // A test may close the database before the end, which closes it once.
  let closed: Promise<void> | undefined;
  return {
    app,
    /** The IP address the client's requests come from. */
    ip,
    client: clientWith({}),
    /** The client of a device signed in with the Session's token. */
    clientOf: (token: string) => clientWith({ authorization: `Bearer ${token}` }),
    /** The client of a device whose requests come from the IP address. */
    clientFrom: (from: string) => clientWith({}, from),
    database,
    close: () => (closed ??= database.close()),
  };
}
