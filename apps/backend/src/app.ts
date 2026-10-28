import {
  createAccounts,
  createCommunityCounters,
  createContentPacks,
  createMistakeReports,
  createSync,
  type Clock,
  type Edition,
  type GoogleVerifier,
  type Mailer,
} from '@slovo/server-core';
import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import { createAuthenticator } from './account/authenticator';
import { createApiHandler, INTERNAL_FAILURE, onUnexpectedFailure } from './api';
import { createContentPackStore } from './content/content-pack-store';
import { createCounterStore } from './counters/counter-store';
import type { Database } from './database/database';
import type { ErrorReporter } from './error-reporter';
import { createEditions } from './edition/editions';
import { createRateLimits } from './rate-limits';
import { createMistakeReportStore } from './reports/mistake-report-store';
import { createUserRecords } from './sync/user-records';

/**
 * The largest request body the API reads; it refuses a larger one before
 * parsing it. The largest request is a push of 500 changes, each a key of 200
 * characters and a value of 8 KB of JSON (ADR 0041): 4.7 MB at most, when
 * every character of its keys takes six bytes of JSON (`\u0001`).
 */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** What the backend is built from. A test gives its own. */
export interface AppDependencies {
  readonly database: Database;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Every Edition the backend serves, read from the Edition folders at start. */
  readonly editions: readonly Edition[];
  /** Sends the sign-in emails. */
  readonly mailer: Mailer;
  /** Verifies the Google identity tokens of Google sign-ins. */
  readonly google: GoogleVerifier;
  /** Signs the Sessions' tokens. */
  readonly authSecret: string;
  /** Where the unexpected failures (500) are reported. */
  readonly reporter: ErrorReporter;
}

type Variables = RequestIdVariables & {
  logger: Logger;
  /** The IP address of the request's connection. */
  ip: string;
};

/** What the backend's Hono app knows of a request: Node's HTTP bindings and its own variables. */
interface Env {
  Bindings: HttpBindings;
  Variables: Variables;
}

/**
 * The IP address the request came from: the address of its connection. A
 * forwarding header such as `X-Forwarded-For` is not trusted, since anyone
 * can send one; trusting the one the deployed proxy sets waits for it (0.9).
 * Node gives every request its connection; a request made in process without
 * one has none.
 */
function connectionIp(bindings: Partial<HttpBindings> | undefined): string | undefined {
  return bindings?.incoming?.socket.remoteAddress;
}

/**
 * The composition root: builds the whole backend from the dependencies it is
 * given. `main.ts` gives the real ones; a test gives its own.
 */
export function createApp({
  database,
  clock,
  logger,
  editions,
  mailer,
  google,
  authSecret,
  reporter,
}: AppDependencies) {
  const editionRegistry = createEditions({ database, clock, editions });
  const rateLimits = createRateLimits(database, { secret: authSecret });
  const accounts = createAccounts({
    editions: editionRegistry,
    authenticator: createAuthenticator(database, { secret: authSecret, logger }),
    google,
    mailer,
    rateLimits,
    clock,
  });
  const contentPacks = createContentPacks({
    editions: editionRegistry,
    store: createContentPackStore(database),
    clock,
  });
  const sync = createSync({
    editions: editionRegistry,
    records: createUserRecords(database),
    rateLimits,
    clock,
  });
  const mistakeReports = createMistakeReports({
    editions: editionRegistry,
    store: createMistakeReportStore(database),
    rateLimits,
    clock,
  });
  const communityCounters = createCommunityCounters({
    editions: editionRegistry,
    store: createCounterStore(database),
    clock,
  });
  const api = createApiHandler({
    accounts,
    communityCounters,
    contentPacks,
    editions: editionRegistry,
    mistakeReports,
    sync,
  });

  const app = new Hono<Env>();

  // Takes the request's x-request-id, or makes one, and sends it back.
  app.use(requestId({ headerName: 'x-request-id' }));
  // Every log line of a request carries its id; one line sums it up.
  app.use(async (c, next) => {
    const started = clock.now().getTime();
    const requestLogger = logger.child({ requestId: c.var.requestId });
    c.set('logger', requestLogger);
    await next();
    requestLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: clock.now().getTime() - started,
      },
      'request',
    );
  });

  // Every request has the IP address of its connection, which the sign-in
  // limits count (ADR 0030); one without is a broken invariant.
  app.use(async (c, next) => {
    const ip = connectionIp(c.env);
    if (ip === undefined) throw new Error('the request came on no connection');
    c.set('ip', ip);
    await next();
  });

  // For a host to tell a sick server: 503 while the database doesn't answer.
  app.get('/health', async (c) => {
    try {
      await database.ping();
      return c.json({ status: 'ok' });
    } catch (error) {
      c.var.logger.warn({ err: error }, 'the database does not answer');
      return c.json({ status: 'unavailable' }, 503);
    }
  });

  // A body too large to be a request of the API is refused before it is
  // parsed and before any Session is checked: at once when its Content-Length
  // says so, else once it has come past the limit.
  app.use(
    '/v1/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ code: 'PAYLOAD_TOO_LARGE' }, 413),
    }),
  );

  // The API contract at `/v1`, its description at `/docs`.
  for (const path of ['/v1/*', '/docs', '/docs/*']) {
    app.use(path, async (c, next) => {
      const { matched, response } = await api.handle(c.req.raw, {
        context: {
          logger: c.var.logger,
          requestId: c.var.requestId,
          reporter,
          headers: c.req.raw.headers,
          ip: c.var.ip,
        },
      });
      if (matched) return c.newResponse(response.body, response);
      return next();
    });
  }

  // An address the backend doesn't serve, under `/v1` too.
  app.notFound((c) => c.json({ code: 'NOT_FOUND' }, 404));

  // The one global handler of what the API's own handler doesn't catch.
  app.onError((error, c) => {
    onUnexpectedFailure({ logger: c.var.logger, requestId: c.var.requestId, reporter }, error);
    return c.json(INTERNAL_FAILURE, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
