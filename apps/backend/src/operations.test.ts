import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';

import { describeApi } from '@slovo/contracts/api-description';
import { sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from './database/database';
import { createLogger } from './logger';
import { startServer } from './server';
import { createTestDatabase, silentLogger, testApp, testDatabaseUrl } from './test-support';

/** A database URL on which nothing listens, as when Postgres is down. */
const DOWN_DATABASE_URL = 'postgres://slovo:slovo@127.0.0.1:1/slovo';

/** Every variable the server needs, valid. */
const VALID_ENV = {
  DATABASE_URL: DOWN_DATABASE_URL,
  SMTP_URL: 'smtp://localhost:1025',
  AUTH_SECRET: 'a-test-secret-that-is-at-least-32-characters',
};

/** Collects what a logger writes, one JSON object per line. */
function logLines() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { lines, logger: createLogger(destination) };
}

/** A promise a test settles by hand, to hold a request where it wants. */
function signal() {
  let fire: () => void = () => undefined;
  const fired = new Promise<void>((resolve) => {
    fire = resolve;
  });
  return { fire, fired };
}

/** Runs the backend's entry point with only the given environment. */
function runServer(env: Record<string, string>) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { PATH: process.env['PATH'] ?? '', ...env },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));
  onTestFinished(() => {
    child.kill();
  });
  const listening = new Promise<void>((resolve, reject) => {
    child.stdout.on('data', () => {
      if (stdout.includes('"msg":"listening"')) resolve();
    });
    void exited.then(() => {
      reject(new Error(`the server exited before listening: ${stderr}`));
    });
  });
  // Only a test that waits for the server to listen cares when it doesn't.
  listening.catch(() => undefined);
  return {
    child,
    exited,
    listening,
    output: () => ({ stdout, stderr }),
  };
}

describe('/health', () => {
  it('answers 200 when the database answers', async () => {
    const { request } = testApp();

    const response = await request('/health');

    expect(response.status).toBe(200);
  });

  it('answers 503 when the database is down', async () => {
    const database = createDatabase(DOWN_DATABASE_URL, silentLogger);
    onTestFinished(() => database.close());
    const { request } = testApp({ database });

    const response = await request('/health');

    expect(response.status).toBe(503);
  });
});

describe('a request', () => {
  it('keeps the x-request-id it brings, in the answer and in its log line', async () => {
    const { lines, logger } = logLines();
    const { request } = testApp({ logger });

    const response = await request('/health', { headers: { 'x-request-id': 'abc-123' } });

    expect(response.headers.get('x-request-id')).toBe('abc-123');
    expect(lines).toContainEqual(
      expect.objectContaining({ requestId: 'abc-123', path: '/health', status: 200 }),
    );
  });

  it('with a body over 8 MB answers 413 PAYLOAD_TOO_LARGE, with no Session needed', async () => {
    const { request } = testApp();
    const email = `${'a'.repeat(8 * 1024 * 1024)}@mail.com`;

    const response = await request('/v1/account/sign-in-codes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, editionId: 'uk' }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('gets a new x-request-id when it brings none', async () => {
    const { request } = testApp();

    const first = await request('/health');
    const second = await request('/health');

    expect(first.headers.get('x-request-id')).toMatch(/\S/);
    expect(second.headers.get('x-request-id')).not.toBe(first.headers.get('x-request-id'));
  });
});

describe('an unexpected failure', () => {
  it('answers a bare 500 INTERNAL and logs its stack with the request id', async () => {
    const { lines, logger } = logLines();
    const database = createDatabase(DOWN_DATABASE_URL, silentLogger);
    onTestFinished(() => database.close());
    const { client } = testApp({ database, logger });

    const failure = client.content.latest({ editionId: 'uk', packFormat: 1 });

    await expect(failure).rejects.toMatchObject({ status: 500 });
    // The contract lists no such answer, so the client keeps its body as it came.
    const { data } = (await failure.catch((error: unknown) => error)) as {
      data: { body: unknown };
    };
    expect(data.body).toEqual({ code: 'INTERNAL' });
    const logged = lines.find((line) => line['msg'] === 'unexpected failure');
    expect(logged?.['requestId']).toMatch(/\S/);
    expect((logged?.['err'] as { stack?: string } | undefined)?.stack).toContain('\n    at ');
  });
});

describe('a request that came on no connection', () => {
  it('answers a bare 500 INTERNAL before any route runs, and logs why', async () => {
    const { lines, logger } = logLines();
    const { app } = testApp({ logger });

    // Node gives every request its connection, so only a request made in
    // process comes without one.
    const response = await app.request('/health');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 'INTERNAL' });
    const logged = lines.find((line) => line['msg'] === 'unexpected failure');
    expect((logged?.['err'] as { message?: string } | undefined)?.message).toBe(
      'the request came on no connection',
    );
  });
});

describe('an unknown address', () => {
  it('answers 404 NOT_FOUND, also under /v1', async () => {
    const { request } = testApp();

    const response = await request('/v1/editions/uk/words');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: 'NOT_FOUND' });
  });
});

describe('/docs', () => {
  it('shows the API in a browser', async () => {
    const { request } = testApp();

    const response = await request('/docs');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it("serves the contract's description, which the repo commits, with the server it is read from", async () => {
    const { request } = testApp();

    const response = await request('/docs/openapi.json');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...(await describeApi()),
      servers: [{ url: 'http://backend.test/' }],
    });
  });
});

describe('the logs', () => {
  it('carry no email, code or token, at the top of a line or two levels down', () => {
    const { lines, logger } = logLines();

    logger.info({
      email: 'anna@mail.com',
      code: '123456',
      token: 'secret-token',
      account: { email: 'anna@mail.com', token: 'secret-token' },
      headers: { authorization: 'Bearer secret-token' },
      ctx: { user: { email: 'anna@mail.com', code: '123456', token: 'secret-token' } },
    });

    const written = JSON.stringify(lines);
    expect(written).not.toContain('anna@mail.com');
    expect(written).not.toContain('123456');
    expect(written).not.toContain('secret-token');
  });

  it('carry no value of a failed query: its text and the error code instead', async () => {
    const own = await createTestDatabase(testDatabaseUrl());
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    // Postgres refuses every window of a limit, and its detail quotes the row.
    await database.db.execute(
      sql`alter table rate_limits add constraint refuses_windows check (false)`,
    );
    const { lines, logger } = logLines();
    const { client } = testApp({ database, logger });

    const failure = client.account.requestCode({ email: 'anna@mail.com', editionId: 'uk' });

    await expect(failure).rejects.toMatchObject({ status: 500 });
    expect(JSON.stringify(lines)).not.toContain('anna@mail.com');
    const logged = lines.find((line) => line['msg'] === 'unexpected failure');
    expect(logged?.['err']).toMatchObject({
      query: expect.stringContaining('insert into "rate_limits"') as unknown,
      cause: { errorCode: '23514', constraint: 'refuses_windows' },
    });
  });

  it("keep a logged error's code, which names its kind", () => {
    const { lines, logger } = logLines();

    logger.warn({ err: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }) });

    expect(lines[0]?.['err']).toMatchObject({ errorCode: 'ECONNREFUSED' });
  });
});

// Starting the entry point loads TypeScript through tsx, which takes seconds on
// a busy machine.
describe('the server', { timeout: 30_000 }, () => {
  it('refuses to start without a required variable, naming it', async () => {
    const { DATABASE_URL: _missing, ...env } = VALID_ENV;
    const server = runServer(env);

    expect(await server.exited).toBe(1);
    expect(server.output().stderr).toContain('DATABASE_URL');
  });

  it('refuses to start with a wrong variable, naming it', async () => {
    const server = runServer({ ...VALID_ENV, AUTH_SECRET: 'short' });

    expect(await server.exited).toBe(1);
    expect(server.output().stderr).toContain('AUTH_SECRET');
  });

  it('refuses to start with the AUTH_SECRET of .env.example, which anyone can read', async () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const secret = /^AUTH_SECRET=(.*)$/m.exec(example)?.[1];
    expect(secret).toBeDefined();
    const server = runServer({ ...VALID_ENV, AUTH_SECRET: secret ?? '' });

    expect(await server.exited).toBe(1);
    expect(server.output().stderr).toContain('AUTH_SECRET: is the example value');
  });

  it('starts with no SENTRY_DSN, as .env.example gives it, and then reports nothing', async () => {
    const server = runServer({
      ...VALID_ENV,
      DATABASE_URL: testDatabaseUrl(),
      PORT: '0',
      SENTRY_DSN: '',
    });

    await server.listening;
  });

  it('refuses to start with a SENTRY_DSN that is no URL, naming it', async () => {
    const server = runServer({ ...VALID_ENV, SENTRY_DSN: 'not-a-dsn' });

    expect(await server.exited).toBe(1);
    expect(server.output().stderr).toContain('SENTRY_DSN');
  });

  it('refuses to start with an http:// SENTRY_DSN, which would send its reports in the clear, naming it', async () => {
    const server = runServer({
      ...VALID_ENV,
      SENTRY_DSN: 'http://public-key@o1.ingest.sentry.io/1',
    });

    expect(await server.exited).toBe(1);
    expect(server.output().stderr).toContain('SENTRY_DSN: must be an https:// Sentry DSN');
  });

  it('stops on SIGTERM', async () => {
    const server = runServer({ ...VALID_ENV, DATABASE_URL: testDatabaseUrl(), PORT: '0' });
    await server.listening;

    server.child.kill('SIGTERM');

    expect(await server.exited).toBe(0);
    expect(server.output().stdout).toContain('"msg":"stopped"');
  });

  it('finishes the requests in flight when it stops, then closes the pool', async () => {
    const database = createDatabase(testDatabaseUrl(), silentLogger);
    const started = signal();
    const answered = signal();
    const { app } = testApp({
      database: {
        ...database,
        ping: async () => {
          started.fire();
          await answered.fired;
          await database.ping();
        },
      },
    });
    const server = await startServer({ app, database, port: 0 });

    const inFlight = fetch(`http://localhost:${String(server.port)}/health`);
    await started.fired;
    const stopped = server.stop();
    answered.fire();

    expect((await inFlight).status).toBe(200);
    await stopped;
    await expect(database.ping()).rejects.toThrow();
    await expect(fetch(`http://localhost:${String(server.port)}/health`)).rejects.toThrow();
  });
});

describe('the test harness', () => {
  it('asks to start Docker when Postgres is not reachable', async () => {
    await expect(createTestDatabase(DOWN_DATABASE_URL)).rejects.toThrow(/Start Docker Desktop/);
  });
});
