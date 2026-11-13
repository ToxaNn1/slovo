/**
 * The harness of the backend's tests (spec #333, seam 2), which Vitest runs before
 * every test file (`setupFiles`). It gives each test file a fresh database of
 * its own, so the files run side by side, and each test one clock: the system
 * time, frozen when the test starts, which both better-auth and the backend's
 * `Clock` read and only `passTime` moves.
 */
import { memoryMediaStore } from './media/media-store';
import { randomInt, randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HttpBindings } from '@hono/node-server';
import { createApiClient } from '@slovo/contracts/api';
import type { EasBuild, MainCi, Milestone, PullRequest, Release } from '@slovo/contracts/admin-api';
import { ADMIN_SESSION_COOKIE, ADMIN_WRITE_HEADER } from '@slovo/contracts/admin-api';
import type { AppConfig, EditionConfig } from '@slovo/contracts';
import { recordContent } from '@slovo/language-pack';
import {
  EDITIONS_DIR,
  editionFiles,
  FONTS_DIR,
  openAppConfig,
  openEdition,
  REPO_DIR,
} from '@slovo/language-pack/edition';
import {
  createOwnerChecks,
  systemClock,
  totpOf,
  type AdminAccess,
  type AdminRole,
  type Alert,
  type Alerts,
  type AppleIdentity,
  type AppleVerifier,
  type EasSource,
  type Edition,
  type GitHubSource,
  type GoogleIdentity,
  type GoogleVerifier,
  type Mail,
  type Mailer,
  type Random,
  type SentryAlertRead,
  type SentryRead,
  type SentryReader,
  type SentryWindow,
} from '@slovo/server-core';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { pino, type Logger } from 'pino';
import { afterAll, afterEach, beforeAll, beforeEach, onTestFinished, vi } from 'vitest';
import { z } from 'zod';

import { keptSignInCode } from './account/authenticator';
import type { CommandDeps } from './admin/admin-command';
import { createAdminStore, hmacSha1 } from './admin/admin-store';
import { createOwnerCheckStore } from './admin/owner-check-store';
import { createApp } from './app';
import { deleteCollectionLink } from './collection-links/collection-link-delete';
import { createDatabase, type Database } from './database/database';
import { migrateDatabase } from './database/migrate';
import { createMediaRows } from './content/media-rows';
import { createContentStore } from './content/content-store';
import { accounts, sessions, signInMethods } from './database/schema';
import { readEditions } from './edition/edition-folders';
import { createEditions } from './edition/editions';
import { systemRandom } from './random';
import { listReports, type ReportFilter } from './reports/report-list';
import { resolveReport } from './reports/report-resolve';
import { createFakePostHog } from './analytics/fake-posthog';
import type { ErrorReport } from './error-reporter';

/** The Postgres of the repo's `compose.yaml`, which the tests use unless `DATABASE_URL` names another. */
const LOCAL_DATABASE_URL = 'postgres://slovo:slovo@localhost:55432/slovo';

/** A logger that writes nothing, for tests that don't read the logs. */
/** Who writes the switches in a test, for the Action log. */
const TEST_WRITE = { who: { kind: 'command', command: 'test' }, reason: 'test' } as const;

/** What `pnpm admin` runs its commands with, over the test's database. */
export function adminCommandDeps(admin: AdminAccess, database: Database): CommandDeps {
  return {
    admin,
    ownerChecks: createOwnerChecks({
      store: createOwnerCheckStore(database),
      clock: systemClock,
      admin,
    }),
    readFile: (path) => readFile(path, 'utf8'),
  };
}

export const silentLogger = pino({ enabled: false });

interface TestDatabase {
  /** The name of the new database. */
  readonly name: string;
  /** The URL of the new database. */
  readonly url: string;
  drop(): Promise<void>;
}

/**
 * Makes a database with a random name on the server `serverUrl` names and
 * runs the migrations on it unless told not to, so a test file never meets another's data.
 * Given a template, the database is a copy of that one, migrations and rows alike.
 */
export async function createTestDatabase(
  serverUrl: string,
  options: { readonly migrate?: boolean } | { readonly template: string } = {},
): Promise<TestDatabase> {
  const name = `slovo_test_${randomUUID().replaceAll('-', '')}`;
  const template = 'template' in options ? options.template : undefined;
  await onServer(
    serverUrl,
    template === undefined
      ? `CREATE DATABASE ${name}`
      : `CREATE DATABASE ${name} TEMPLATE ${template}`,
  );
  const drop = () => onServer(serverUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  try {
    if (!('template' in options) && options.migrate !== false) {
      await migrateDatabase(url.href, silentLogger);
    }
  } catch (error) {
    await drop();
    throw error;
  }
  return { name, url: url.href, drop };
}

/**
 * Hands out databases of a test's own with the Edition folder imported. The
 * folder is read, checked and imported once per test file, into a template,
 * and each database is a copy of it: a test pays a copy, not an import of the
 * whole Edition. The template is dropped after the file.
 */
export function importedDatabases(
  editionId: string,
  editionDir: string,
  prepare: (database: Database) => Promise<unknown> = () => Promise.resolve(),
) {
  let template: Promise<TestDatabase> | undefined;
  afterAll(async () => {
    await template?.then(
      (made) => made.drop(),
      () => undefined,
    );
  });
  async function makeTemplate() {
    const made = await createTestDatabase(testDatabaseUrl());
    const database = createDatabase(made.url, silentLogger);
    try {
      const result = await testApp({ database }).importContent(editionId, editionDir);
      if (!result.ok) throw new Error(`the ${editionId} Edition did not import`);
      await prepare(database);
    } finally {
      // A template takes no copy while a connection to it is open.
      await database.close();
    }
    return made;
  }
  return async (): Promise<TestDatabase> => {
    template ??= makeTemplate();
    const { name } = await template;
    return createTestDatabase(testDatabaseUrl(), { template: name });
  };
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

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));
const JOURNAL_FILE = 'meta/_journal.json';
const JOURNAL = z.looseObject({ entries: z.array(z.looseObject({ tag: z.string() })) });

/**
 * The migrations folder as it was before the migration whose name ends with
 * `suffix`: a copy with the journal cut there, removed when the test finishes.
 */
export function migrationsBefore(suffix: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-migrations-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  cpSync(MIGRATIONS_DIR, dir, { recursive: true });
  const journal = JOURNAL.parse(JSON.parse(readFileSync(join(dir, JOURNAL_FILE), 'utf8')));
  const cut = journal.entries.findIndex((entry) => entry.tag.endsWith(suffix));
  if (cut === -1) throw new Error(`no migration ends with ${suffix}`);
  writeFileSync(
    join(dir, JOURNAL_FILE),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, cut) }),
  );
  return dir;
}

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
  /** Makes the next email fail to send, as ZeptoMail refusing it. */
  failNext(): void;
}

function createFakeMailer(): FakeMailer {
  const sent: Mail[] = [];
  let failing = false;
  return {
    sent,
    failNext() {
      failing = true;
    },
    send: (mail) => {
      if (failing) {
        failing = false;
        return Promise.reject(new Error('the email was not sent (ZeptoMail 500)'));
      }
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

/** Alerts that keep every alert they are given, oldest first. */
interface FakeAlerts extends Alerts {
  readonly sent: readonly Alert[];
}

function createFakeAlerts(): FakeAlerts {
  const sent: Alert[] = [];
  return {
    sent,
    send: (alert) => {
      sent.push(alert);
      return Promise.resolve();
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
 * The app's bundle id (`app/app.json`), the audience of the fake Apple's
 * tokens unless a test names another: the backend checks an Apple token
 * against the AppConfig's bundle id (ADR 0047).
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
 * the test's clock and the audience against the app's bundle id.
 */
export interface FakeApple extends AppleVerifier {
  /**
   * An identity token for the email, as the sign-in sheet would give it: from
   * Apple, for the UA Edition's app, for ten minutes, unless the test
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

/**
 * An editions folder made for one test, with an Edition for each id: a copy of
 * the UA Edition's config, strings and content under its own id.
 * `change` changes each config. Copying and recording the content takes a
 * while, so an Edition gets it when a test first imports or corrects it.
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
    cpSync(ukrainian.path('strings'), edition.path('strings'));
    writeFileSync(edition.path('config'), JSON.stringify(change({ ...config, id })));
  }
  const record = (editionDir: string) => {
    if (!recordContent({ editionDir }).ok) throw new Error('Content not recorded');
  };
  const withContent = new Set<string>();
  /** The Edition's folder, with its content. */
  const contentOf = (id: string) => {
    const { dir: editionDir } = editionFiles(join(dir, id));
    if (!withContent.has(id)) {
      cpSync(join(ukrainian.dir, 'content'), join(editionDir, 'content'), { recursive: true });
      // The Edition check reads the font of the Word of the Day the config names.
      cpSync(join(ukrainian.dir, FONTS_DIR), join(editionDir, FONTS_DIR), { recursive: true });
      // The content checksum takes in the Edition, so the copy is recorded under its own id.
      record(editionDir);
      withContent.add(id);
    }
    return editionDir;
  };

  return {
    /** Every Edition of the folder, as the backend reads them now. */
    read(): Edition[] {
      return readEditions(dir);
    },
    /** The Edition's folder with its content, as an import reads it. */
    content: contentOf,
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

/** The AppConfig of the repo (ADR 0065), the one app the backend serves. */
export const testAppConfig = openAppConfig(REPO_DIR).config;

/** The fake GitHub's open pull request, CI run, milestones and release. */
export const GITHUB_FIXTURE: {
  pullRequests: PullRequest[];
  mainCi: MainCi;
  milestones: Milestone[];
  releases: Release[];
} = {
  pullRequests: [
    {
      number: 1750,
      title: 'feat(admin): the Розробка section',
      author: 'anton',
      url: 'https://github.com/ToxaNn1/slovo/pull/1750',
      draft: false,
      updatedAt: '2026-11-08T09:00:00.000Z',
    },
  ],
  mainCi: {
    state: 'success',
    url: 'https://github.com/ToxaNn1/slovo/actions/runs/1',
    finishedAt: '2026-11-08T08:00:00.000Z',
  },
  milestones: [
    { title: '1.0', open: 30, closed: 0, dueOn: null },
    { title: 'Backlog', open: 9, closed: 1, dueOn: null },
    { title: '0.9', open: 4, closed: 12, dueOn: '2026-12-01T00:00:00.000Z' },
  ],
  releases: [
    {
      tag: 'v0.8.0',
      name: '0.8',
      publishedAt: '2026-10-20T10:00:00.000Z',
      url: 'https://github.com/ToxaNn1/slovo/releases/tag/v0.8.0',
    },
  ],
};

/** The fake EAS's one build. */
export const EAS_FIXTURE: EasBuild[] = [
  {
    id: 'build-1',
    platform: 'ios',
    profile: 'production',
    status: 'finished',
    appVersion: '0.8.0',
    buildNumber: '42',
    createdAt: '2026-11-07T18:00:00.000Z',
    url: 'https://expo.dev/accounts/slovo/projects/slovo/builds/build-1',
  },
];

/** A fake outside service: it counts its calls and fails once told to. */
interface FakeSource {
  /** How many reads it answered. */
  readonly calls: number;
  /** From now on every read answers `unavailable`. */
  fail(): void;
}

const unavailable = { ok: false, reason: 'unavailable' } as const;

/** A GitHub that answers GITHUB_FIXTURE. */
export function createFakeGitHub(): GitHubSource & FakeSource {
  let calls = 0;
  let failing = false;
  const answer =
    <Value>(value: Value) =>
    () => {
      calls += 1;
      return Promise.resolve(failing ? unavailable : ({ ok: true, value } as const));
    };
  return {
    get calls() {
      return calls;
    },
    fail: () => (failing = true),
    pullRequests: answer(GITHUB_FIXTURE.pullRequests),
    mainCi: answer(GITHUB_FIXTURE.mainCi),
    milestones: answer(GITHUB_FIXTURE.milestones),
    releases: answer(GITHUB_FIXTURE.releases),
  };
}

/** An EAS that answers EAS_FIXTURE. */
export function createFakeEas(): EasSource & FakeSource {
  let calls = 0;
  let failing = false;
  return {
    get calls() {
      return calls;
    },
    fail: () => (failing = true),
    latestBuilds: (limit) => {
      calls += 1;
      return Promise.resolve(
        failing ? unavailable : { ok: true, value: EAS_FIXTURE.slice(0, limit) },
      );
    },
  };
}

interface TestAppOptions {
  /** A database of the test's own, which the test closes; the file's database unless given. */
  readonly database?: Database;
  /** A silent logger unless given. */
  readonly logger?: Logger;
  /** The repo's AppConfig unless given. */
  readonly app?: AppConfig;
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
  /** The built owner admin app's folder; none unless given. */
  readonly adminDist?: string;
  /** GitHub, for Розробка; a fake GitHub unless given. */
  readonly github?: GitHubSource;
  /** EAS, for Розробка; a fake EAS unless given. */
  readonly eas?: EasSource;
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
  app: appConfig = testAppConfig,
  editions = readEditions(EDITIONS_DIR),
  googleClientIds = [TEST_GOOGLE_CLIENT_ID],
  google: givenGoogle,
  apple: givenApple,
  random = systemRandom,
  trustedProxyHops = 0,
  adminDist,
  github = createFakeGitHub(),
  eas = createFakeEas(),
  onAnswer,
}: TestAppOptions = {}) {
  const database = given ?? createDatabase(testDatabaseUrl(), silentLogger);
  const mediaStore = memoryMediaStore();
  const mailer = createFakeMailer();
  const alerts = createFakeAlerts();
  const posthog = createFakePostHog();
  const google = createFakeGoogle(googleClientIds);
  const apple = createFakeApple();
  const reports: ErrorReport[] = [];
  const sentry = createFakeSentry();
  const app = createApp({
    database,
    clock: systemClock,
    random,
    logger,
    app: appConfig,
    editions,
    mailer,
    alerts,
    posthog,
    google: givenGoogle ?? google,
    apple: givenApple ?? apple,
    authSecret: TEST_AUTH_SECRET,
    // A fake Sentry: it keeps every report.
    reporter: { report: (report) => reports.push(report) },
    trustedProxyHops,
    adminDist,
    github,
    eas,
    sentry,
    ciToken: TEST_CI_TOKEN,
    mediaBase: TEST_MEDIA_BASE,
    mediaStore,
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
    /** The fake Media Store the content editor keeps Illustrations in. */
    mediaStore,
    /** The IP address the requests come from unless the test names another. */
    ip,
    /** Every email the backend sent. */
    mailer,
    /** Every alert the backend sent the owner. */
    alerts,
    /** The fake Sentry Якість reads. */
    sentry,
    /** The fake PostHog the Аналітика reads from. */
    posthog,
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
    /** The client of a request with the headers, such as the admin's cookie and write header. */
    clientWith,
    /** The client of a device signed in with the Session's token. */
    clientOf: (token: string) => clientWith({ authorization: `Bearer ${token}` }),
    /** The client of a device whose requests come from the IP address. */
    clientFrom: (from: string) => clientWith({}, from),
    /** The Kill switch of the feature in the Edition, as the switches command turns it off. */
    kill: (editionId: string, feature: string) =>
      createEditions({ database, clock: systemClock, editions, alerts }).kill(
        feature,
        editionId,
        TEST_WRITE,
      ),
    /** Clears every Rule of the feature in the Edition, back to the Edition's state. */
    clearRules: (editionId: string, feature: string) =>
      createEditions({ database, clock: systemClock, editions, alerts }).setRules(
        editionId,
        feature,
        [],
        TEST_WRITE,
      ),
    /** The Edition's media rows, written as the Recording generation and the Illustration upload write them. */
    media: createMediaRows({ database, clock: systemClock }),
    /** Imports the Edition folder into the content tables, as the import command does. */
    importContent: (editionId: string, editionDir: string, options?: { override?: boolean }) =>
      createContentStore({
        database,
        clock: systemClock,
        editions: createEditions({ database, clock: systemClock, editions, alerts }),
      }).importEdition(editionId, editionDir, options),
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

/** The token CI pushes its history with, in tests. */
/** The Media Store's URL root the test backend names. */
export const TEST_MEDIA_BASE = 'https://media.slovo.test';

export const TEST_CI_TOKEN = 'a-test-ci-history-token-of-32-characters-at-least';

/** A Sentry that answers the numbers a test sets, and counts the reads it was asked. */
export interface FakeSentry extends SentryReader {
  /** The number every later read of the kind answers, for a window ending at or before `until` (now unless given). */
  set(read: SentryRead | SentryAlertRead, value: number | null, window?: 'now' | 'yesterday'): void;
  /** Every later read answers rate-limited until the time, or answers again when `undefined`. */
  limit(retryAt: Date | undefined): void;
  /** The windows of the reads asked, oldest first. */
  readonly asked: readonly ({ readonly read: SentryRead | SentryAlertRead } & SentryWindow)[];
}

/**
 * A fake Sentry. A read whose window ends a day or more before the newest
 * window asked of its kind answers its `yesterday` number, any other its
 * `now` number; numbers not set answer `null`.
 */
export function createFakeSentry(): FakeSentry {
  const numbers = new Map<string, number | null>();
  const asked: ({ read: SentryRead | SentryAlertRead } & SentryWindow)[] = [];
  let limitedUntil: Date | undefined;
  return {
    asked,
    set: (read, value, window = 'now') => numbers.set(`${read}|${window}`, value),
    limit: (retryAt) => (limitedUntil = retryAt),
    read(read, window) {
      asked.push({ read, ...window });
      if (limitedUntil !== undefined) {
        return Promise.resolve({ ok: false, reason: 'rate-limited', retryAt: limitedUntil });
      }
      const behind = Date.now() - window.to.getTime() >= 24 * 60 * 60 * 1000;
      const value = numbers.get(`${read}|${behind ? 'yesterday' : 'now'}`) ?? null;
      return Promise.resolve({ ok: true, value });
    },
  };
}

/** The headers of the admin app: its write header, and the session cookie when signed in. */
export const adminHeaders = (cookie?: string): Record<string, string> => ({
  [ADMIN_WRITE_HEADER]: '1',
  ...(cookie === undefined ? {} : { cookie }),
});

/** The `name=value` of the admin session cookie an answer sets. */
export function adminCookieOf(response: Response): string {
  const set = response.headers.get('set-cookie') ?? '';
  const pair = set.split(';')[0] ?? '';
  if (!pair.startsWith(`${ADMIN_SESSION_COOKIE}=`)) throw new Error('no admin session cookie set');
  return pair;
}

/**
 * Signs the Admin user in as the admin app does, the first time: the emailed
 * code, the TOTP set-up, then the code and a TOTP. Answers the session cookie,
 * the client of the session, and what the set-up showed.
 */
export async function signInAdmin(backend: ReturnType<typeof testApp>, email: string) {
  const anonymous = backend.clientWith(adminHeaders());
  await anonymous.admin.requestCode({ email });
  const code = backend.mailer.codeSentTo(email);
  const enrolment = await anonymous.admin.verifyCode({ email, code });
  if (enrolment.next !== 'enrol') throw new Error(`${email} has a TOTP already`);
  const response = await backend.request('/v1/admin/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({
      email,
      code,
      factor: { kind: 'totp', totp: totpOf(hmacSha1, enrolment.secret, new Date()) },
    }),
  });
  if (response.status !== 200) throw new Error(`sign-in answered ${String(response.status)}`);
  const cookie = adminCookieOf(response);
  return { email, cookie, enrolment, client: backend.clientWith(adminHeaders(cookie)) };
}

/** Adds an Admin user of the role to the backend's database, and signs them in. */
export async function signedInAdmin(
  backend: ReturnType<typeof testApp>,
  role: AdminRole,
  email = `${role}-${randomUUID()}@example.com`,
) {
  await createAdminStore(backend.database).addAdminUser({ email, role, createdAt: new Date() });
  return signInAdmin(backend, email);
}

/** A square PNG header of the size, padded to the length in bytes; the seed makes its content its own. */
export function png(width: number, height: number, length = 2_000, seed = 0): Buffer {
  const bytes = Buffer.alloc(length, seed);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(bytes);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}
