/**
 * The harness of the backend's tests (spec #333, seam 2), which Vitest runs before
 * every test file (`setupFiles`). It gives each test file a fresh database of
 * its own, so the files run side by side, and each test one clock: the system
 * time, frozen when the test starts, which both better-auth and the backend's
 * `Clock` read and only `passTime` moves.
 */
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { HttpBindings } from '@hono/node-server';
import { createApiClient } from '@slovo/contracts/api';
import type { EditionConfig } from '@slovo/contracts';
import { buildLanguagePack, recordContent } from '@slovo/language-pack';
import {
  EDITIONS_DIR,
  editionFiles,
  FONTS_DIR,
  ILLUSTRATIONS_DIR,
  openEdition,
} from '@slovo/language-pack/edition';
import {
  systemClock,
  type AppleIdentity,
  type AppleVerifier,
  type Edition,
  type GoogleIdentity,
  type GoogleVerifier,
  type Mail,
  type Mailer,
  type Random,
} from '@slovo/server-core';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { pino, type Logger } from 'pino';
import { afterAll, afterEach, beforeAll, beforeEach, onTestFinished, vi } from 'vitest';

import { keptSignInCode } from './account/authenticator';
import { createApp } from './app';
import { deleteCollectionLink } from './collection-links/collection-link-delete';
import { publishPack } from './content/publish-pack';
import { createDatabase, type Database } from './database/database';
import { migrateDatabase } from './database/migrate';
import { accounts, sessions, signInMethods } from './database/schema';
import { readEditions } from './edition/edition-folders';
import { createEditions } from './edition/editions';
import { systemRandom } from './random';
import { listReports, type ReportFilter } from './reports/report-list';
import { resolveReport } from './reports/report-resolve';
import type { ErrorReport } from './error-reporter';

/** The Postgres of the repo's `compose.yaml`, which the tests use unless `DATABASE_URL` names another. */
const LOCAL_DATABASE_URL = 'postgres://slovo:slovo@localhost:55432/slovo';

/** A logger that writes nothing, for tests that don't read the logs. */
export const silentLogger = pino({ enabled: false });

interface TestDatabase {
  /** The URL of the new database. */
  readonly url: string;
  drop(): Promise<void>;
}

/**
 * Makes a database with a random name on the server `serverUrl` names and
 * runs the migrations on it unless told not to, so a test file never meets another's data.
 */
export async function createTestDatabase(
  serverUrl: string,
  { migrate = true }: { readonly migrate?: boolean } = {},
): Promise<TestDatabase> {
  const name = `slovo_test_${randomUUID().replaceAll('-', '')}`;
  await onServer(serverUrl, `CREATE DATABASE ${name}`);
  const drop = () => onServer(serverUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  try {
    if (migrate) await migrateDatabase(url.href, silentLogger);
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

// The database of this test file, which its tests share and no other file sees.
let fileDatabase: TestDatabase | undefined;
beforeAll(async () => {
  fileDatabase = await createTestDatabase(process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL);
});
afterAll(() => fileDatabase?.drop());

/** The URL of this test file's database, migrated. */
export function testDatabaseUrl(): string {
  if (fileDatabase === undefined) throw new Error('the test file has no database yet');
  return fileDatabase.url;
}

// Timers stay real: only the time a test reads stands still.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Moves the test's clock on, for better-auth and the backend alike. */
export function passTime(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

/** A Mailer that keeps every email it is given, so a test reads the Sign-in code. */
interface FakeMailer extends Mailer {
  /** Every email sent, oldest first. */
  readonly sent: readonly Mail[];
  /** The six digits of the newest email to the address. Throws when none was sent. */
  codeSentTo(email: string): string;
}

function createFakeMailer(): FakeMailer {
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

/** The Google client id of the test backends, unless a test gives its own. */
export const TEST_GOOGLE_CLIENT_ID = 'slovo-test.apps.googleusercontent.com';

/** What a fake Google identity token carries, as the fake Google signed it. */
interface FakeGoogleToken extends GoogleIdentity {
  /** The client id of the app the token is for. */
  readonly audience: string;
  /** When the token runs out, in milliseconds since the epoch. */
  readonly expiresAt: number;
  /** The fake Google's signature; a token of another signer doesn't check. */
  readonly signature: string;
}

/** What makes a token the fake Google gives differ from the one a valid sign-in needs. */
interface FakeTokenOptions {
  /** The app the token is for; the backend's own client id unless given. */
  readonly audience?: string;
  /** When the token runs out; an hour from now unless given. */
  readonly expiresAt?: Date;
  /** Whether the fake Google signed it; a token signed by someone else doesn't check. */
  readonly signed?: boolean;
}

/** How long a Google identity token lasts. */
const GOOGLE_TOKEN_MS = 60 * 60 * 1000;

const FAKE_GOOGLE_SIGNATURE = 'signed-by-the-fake-google';

/**
 * A fake Google, in two parts: the sign-in sheet's side, which gives the app
 * identity tokens, and the verifier's side, which checks them the way the
 * real verifier checks Google's: the signature, the expiry against the
 * test's clock and the audience against the backend's client ids.
 */
export interface FakeGoogle extends GoogleVerifier {
  /**
   * An identity token for the email, as the sign-in sheet would give it:
   * for the backend's own app, for an hour, with the email verified, unless
   * the test says otherwise.
   */
  token(
    identity: Partial<GoogleIdentity> & Pick<GoogleIdentity, 'email'>,
    options?: FakeTokenOptions,
  ): string;
}

export function createFakeGoogle(clientIds: readonly string[]): FakeGoogle {
  return {
    token({ email, subject = `google-${email}`, emailVerified = true }, options = {}) {
      const token: FakeGoogleToken = {
        subject,
        email,
        emailVerified,
        audience: options.audience ?? TEST_GOOGLE_CLIENT_ID,
        expiresAt: (options.expiresAt ?? new Date(Date.now() + GOOGLE_TOKEN_MS)).getTime(),
        signature: options.signed === false ? 'signed-by-someone-else' : FAKE_GOOGLE_SIGNATURE,
      };
      return Buffer.from(JSON.stringify(token)).toString('base64url');
    },
    verify(idToken) {
      if (clientIds.length === 0) return Promise.resolve({ ok: false, reason: 'not-configured' });
      let token: FakeGoogleToken;
      try {
        token = JSON.parse(Buffer.from(idToken, 'base64url').toString()) as FakeGoogleToken;
      } catch {
        return Promise.resolve({ ok: false, reason: 'invalid-token' });
      }
      if (token.signature !== FAKE_GOOGLE_SIGNATURE || token.expiresAt <= Date.now()) {
        return Promise.resolve({ ok: false, reason: 'invalid-token' });
      }
      if (!clientIds.includes(token.audience)) {
        return Promise.resolve({ ok: false, reason: 'foreign-audience' });
      }
      const { subject, email, emailVerified } = token;
      return Promise.resolve({ ok: true, identity: { subject, email, emailVerified } });
    },
  };
}

/**
 * The bundle id of the Ukrainian Edition (`editions/uk/edition.json`), the
 * audience of the fake Apple's tokens unless a test names another: the
 * backend checks an Apple token against the Edition's bundle id (ADR 0047).
 */
export const UK_BUNDLE_ID = 'app.slovo.uk';

/** Who issues Apple identity tokens; the fake's tokens name it unless a test names another. */
export const APPLE_ISSUER = 'https://appleid.apple.com';

/** What a fake Apple identity token carries, as the fake Apple signed it. */
interface FakeAppleToken extends AppleIdentity {
  readonly issuer: string;
  /** The bundle id of the app the token is for. */
  readonly audience: string;
  /** When the token runs out, in milliseconds since the epoch. */
  readonly expiresAt: number;
  /** The fake Apple's signature; a token of another signer doesn't check. */
  readonly signature: string;
}

/** What makes a token the fake Apple gives differ from the one a valid sign-in needs. */
interface FakeAppleTokenOptions extends FakeTokenOptions {
  /** Who issued it; Apple unless given. */
  readonly issuer?: string;
}

/** How long an Apple identity token lasts. */
const APPLE_TOKEN_MS = 10 * 60 * 1000;

const FAKE_APPLE_SIGNATURE = 'signed-by-the-fake-apple';

/**
 * A fake Apple, in two parts: the sign-in sheet's side, which gives the app
 * identity tokens, and the verifier's side, which checks them the way the
 * real verifier checks Apple's: the signature, the issuer, the expiry against
 * the test's clock and the audience against the Edition's bundle id.
 */
export interface FakeApple extends AppleVerifier {
  /**
   * An identity token for the email, as the sign-in sheet would give it: from
   * Apple, for the Ukrainian Edition's app, for ten minutes, unless the test
   * says otherwise.
   */
  token(
    identity: Partial<AppleIdentity> & Pick<AppleIdentity, 'email'>,
    options?: FakeAppleTokenOptions,
  ): string;
}

export function createFakeApple(): FakeApple {
  return {
    token({ email, subject = `apple-${email}` }, options = {}) {
      const token: FakeAppleToken = {
        subject,
        email,
        issuer: options.issuer ?? APPLE_ISSUER,
        audience: options.audience ?? UK_BUNDLE_ID,
        expiresAt: (options.expiresAt ?? new Date(Date.now() + APPLE_TOKEN_MS)).getTime(),
        signature: options.signed === false ? 'signed-by-someone-else' : FAKE_APPLE_SIGNATURE,
      };
      return Buffer.from(JSON.stringify(token)).toString('base64url');
    },
    verify(idToken, bundleId) {
      let token: FakeAppleToken;
      try {
        token = JSON.parse(Buffer.from(idToken, 'base64url').toString()) as FakeAppleToken;
      } catch {
        return Promise.resolve({ ok: false, reason: 'invalid-token' });
      }
      if (
        token.signature !== FAKE_APPLE_SIGNATURE ||
        token.issuer !== APPLE_ISSUER ||
        token.expiresAt <= Date.now()
      ) {
        return Promise.resolve({ ok: false, reason: 'invalid-token' });
      }
      if (token.audience !== bundleId) {
        return Promise.resolve({ ok: false, reason: 'foreign-audience' });
      }
      const { subject, email } = token;
      return Promise.resolve({ ok: true, identity: { subject, email } });
    },
  };
}

/** The SHA-256 of a file's bytes, as 64 lowercase hex digits. */
export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A Language Pack a test built, and what `content.latest` announces for it once published. */
interface BuiltPack {
  readonly editionId: string;
  readonly file: string;
  readonly announced: {
    readonly contentVersion: number;
    readonly packFormat: number;
    readonly size: number;
    readonly fileSha256: string;
  };
}

/**
 * An editions folder made for one test, with an Edition for each id: a copy of
 * the Ukrainian Edition's config, strings and content under its own id.
 * `change` changes each config. Copying and recording the content takes a
 * while, so an Edition gets it when a test first builds or corrects it, which
 * comes before the test reads the Editions.
 */
export function testEditions(
  ids: readonly string[],
  change: (config: EditionConfig) => EditionConfig = (config) => config,
) {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const ukrainian = openEdition(EDITIONS_DIR, 'uk');
  const config = JSON.parse(readFileSync(ukrainian.path('config'), 'utf8')) as EditionConfig;
  for (const id of ids) {
    const edition = editionFiles(join(dir, id));
    // The backend reads the manifest, not the content it records.
    cpSync(ukrainian.path('manifest'), edition.path('manifest'));
    cpSync(ukrainian.path('strings'), edition.path('strings'));
    writeFileSync(edition.path('config'), JSON.stringify(change({ ...config, id })));
  }
  const record = (editionDir: string) => {
    if (!recordContent({ editionDir }).ok) throw new Error('Content not recorded');
  };
  const withContent = new Set<string>();
  let read = false;
  /** The Edition's folder, with its content. */
  const contentOf = (id: string) => {
    const { dir: editionDir } = editionFiles(join(dir, id));
    if (!withContent.has(id)) {
      // The Editions read before would carry a manifest that doesn't record it.
      if (read) throw new Error(`build or correct ${id} before reading the Editions`);
      cpSync(join(ukrainian.dir, 'content'), join(editionDir, 'content'), { recursive: true });
      // The Words name these, so the content is recorded only with them.
      cpSync(join(ukrainian.dir, ILLUSTRATIONS_DIR), join(editionDir, ILLUSTRATIONS_DIR), {
        recursive: true,
      });
      // The Edition check reads the font of the Word of the Day the config names.
      cpSync(join(ukrainian.dir, FONTS_DIR), join(editionDir, FONTS_DIR), { recursive: true });
      // The content checksum takes in the Edition, so the copy is recorded under its own id.
      record(editionDir);
      withContent.add(id);
    }
    return editionDir;
  };

  let builds = 0;
  return {
    /** Every Edition of the folder, as the backend reads them now. */
    read(): Edition[] {
      read = true;
      return readEditions(dir);
    },
    /** Builds the Edition's pack of its content as it is now. */
    buildPack(editionId: string): BuiltPack {
      builds += 1;
      const file = join(dir, `language-pack-${String(builds)}.db`);
      const built = buildLanguagePack({ editionDir: contentOf(editionId), outFile: file });
      if (!built.ok) throw new Error('Pack not built');
      const bytes = readFileSync(file);
      return {
        editionId,
        file,
        announced: {
          contentVersion: built.metadata.contentVersion,
          packFormat: built.metadata.packFormat,
          size: bytes.byteLength,
          fileSha256: sha256(bytes),
        },
      };
    },
    /** Corrects a Word's Definition and records the content, which raises its version. */
    correctWord(editionId: string): void {
      const editionDir = contentOf(editionId);
      const wordsDir = join(editionDir, 'content/words');
      const name = readdirSync(wordsDir).find((file) => file.endsWith('.json'));
      if (name === undefined) throw new Error('No Word to correct');
      const file = join(wordsDir, name);
      const word = JSON.parse(readFileSync(file, 'utf8')) as { primaryDefinition: string };
      const primaryDefinition = `${word.primaryDefinition} (corrected)`;
      writeFileSync(file, JSON.stringify({ ...word, primaryDefinition }));
      record(editionDir);
    },
  };
}

/** The secret the test backends sign their Sessions with. */
const TEST_AUTH_SECRET = 'a-test-secret-that-is-at-least-32-characters';

/** An IP address no other test uses, from the range kept for documentation (RFC 3849). */
export const newIp = () =>
  `2001:db8:${[0, 0].map(() => randomInt(0x10000).toString(16)).join(':')}::1`;

/**
 * What Node's HTTP server gives the app with a request that came on a
 * connection from the IP address: the part the app reads.
 */
const connectionFrom = (ip: string) =>
  ({ incoming: { socket: { remoteAddress: ip } } }) as unknown as HttpBindings;

interface TestAppOptions {
  /** A database of the test's own, which the test closes; the file's database unless given. */
  readonly database?: Database;
  /** A silent logger unless given. */
  readonly logger?: Logger;
  /** The Editions the backend serves; the repo's own unless given. */
  readonly editions?: readonly Edition[];
  /** The backend's Google client ids; the test one unless given. None turns Google sign-in off. */
  readonly googleClientIds?: readonly string[];
  /** The Google verifier; the fake Google of the client ids unless given. */
  readonly google?: GoogleVerifier;
  /** The Apple verifier; the fake Apple unless given. */
  readonly apple?: AppleVerifier;
  /** Where the ids of new Collection Links come from; the system's randomness unless given. */
  readonly random?: Random;
  /** How many proxies in front of the backend it trusts; none unless given. */
  readonly trustedProxyHops?: number;
  /** Sees every answer before the test gets it, with the request it answers. */
  readonly onAnswer?: (request: Request, response: Response) => Promise<void>;
}

/**
 * The backend built by its composition root, with the test's clock, a fake
 * Mailer, a fake Google and a fake Apple, and the ways a test sends it requests: the API's client, or a
 * request of its own. Every request goes to the app in process, so no port is
 * opened, and comes on a connection: from the backend's own IP address unless
 * the test names another, so the limits per IP of one test never reach
 * another. The database it opens closes when the test finishes.
 */
export function testApp({
  database: given,
  logger = silentLogger,
  editions = readEditions(EDITIONS_DIR),
  googleClientIds = [TEST_GOOGLE_CLIENT_ID],
  google: givenGoogle,
  apple: givenApple,
  random = systemRandom,
  trustedProxyHops = 0,
  onAnswer,
}: TestAppOptions = {}) {
  const database = given ?? createDatabase(testDatabaseUrl(), silentLogger);
  const mailer = createFakeMailer();
  const google = createFakeGoogle(googleClientIds);
  const apple = createFakeApple();
  const reports: ErrorReport[] = [];
  const app = createApp({
    database,
    clock: systemClock,
    random,
    logger,
    editions,
    mailer,
    google: givenGoogle ?? google,
    apple: givenApple ?? apple,
    authSecret: TEST_AUTH_SECRET,
    // A fake Sentry: it keeps every report.
    reporter: { report: (report) => reports.push(report) },
    trustedProxyHops,
  });
  const ip = newIp();
  // The one way a request reaches the app.
  const send = async (request: Request, from = ip) => {
    const response = await app.fetch(request, connectionFrom(from));
    await onAnswer?.(request, response);
    return response;
  };
  // The client the app uses, built from the contract, with its fetch pointed
  // at the app in process.
  const clientWith = (headers: Record<string, string>, from = ip) =>
    createApiClient({
      url: 'http://backend.test',
      fetch: (request) => send(request, from),
      headers,
    });
  // A test may close the database before the end, which closes it once.
  let closed: Promise<void> | undefined;
  const close = () => (closed ??= database.close());
  if (given === undefined) onTestFinished(close);
  /**
   * What the database keeps of the email's Account, how many Accounts it
   * keeps for the email, and the Sign-in code waiting for it.
   */
  async function rowsOf(email: string) {
    const { db } = database;
    const found = await db.select().from(accounts).where(eq(accounts.email, email));
    const [account] = found;
    const ofAccount = async (table: typeof sessions | typeof signInMethods) =>
      account === undefined ? [] : db.select().from(table).where(eq(table.accountId, account.id));
    return {
      account,
      accountRows: found.length,
      sessions: await ofAccount(sessions),
      signInMethods: await ofAccount(signInMethods),
      signInCode: await keptSignInCode(database, email),
    };
  }
  return {
    /** The app itself, for a test that serves it over HTTP. */
    app,
    /** The IP address the requests come from unless the test names another. */
    ip,
    /** Every email the backend sent. */
    mailer,
    /** The fake Google the backend verifies tokens with, and the tokens its sign-in sheet gives. */
    google,
    /** The fake Apple the backend verifies tokens with, and the tokens its sign-in sheet gives. */
    apple,
    /** Every report of an unexpected failure the backend sent, oldest first. */
    reports: reports as readonly ErrorReport[],
    database,
    /** What the database keeps of the Sign-in code waiting for the email (see the Authenticator). */
    keptSignInCode: (email: string) => keptSignInCode(database, email),
    rowsOf,
    /** Sends a request of the test's own, to read what the client doesn't, such as headers. */
    request: (path: string, init?: RequestInit, from?: string) =>
      send(new Request(new URL(path, 'http://backend.test'), init), from),
    client: clientWith({}),
    /** The client of a device signed in with the Session's token. */
    clientOf: (token: string) => clientWith({ authorization: `Bearer ${token}` }),
    /** The client of a device whose requests come from the IP address. */
    clientFrom: (from: string) => clientWith({}, from),
    /**
     * Publishes the pack file as the publish command does, on the backend's
     * database: for the Editions it serves unless given those of the moment.
     */
    publish: (pack: Pick<BuiltPack, 'editionId' | 'file'>, editionsNow = editions) =>
      publishPack({ database, clock: systemClock, editions: editionsNow, ...pack }),
    /** Turns the feature off in the Edition remotely, as the off command does, on the backend's database. */
    switchOff: (editionId: string, feature: string) =>
      createEditions({ database, clock: systemClock, editions }).switchOff(editionId, feature),
    /** Clears the Edition's remote switch of the feature, as the clear command does. */
    clearSwitch: (editionId: string, feature: string) =>
      createEditions({ database, clock: systemClock, editions }).clearSwitch(editionId, feature),
    /** The lines the reports list command prints of the reports the backend keeps. */
    listReports: (filter?: ReportFilter) => listReports(database, filter),
    /** What the reports resolve command prints and exits with for the id. */
    resolveReport: (id: string) => resolveReport(database, id),
    /** What the collection-links delete command prints and exits with for the id. */
    deleteCollectionLink: (id: string) => deleteCollectionLink(database, id),
    /** Closes the database the backend opened, as when Postgres goes away. */
    close,
  };
}
