import {
  createAccounts,
  createCollectionLinks,
  createCommunityCounters,
  createContentPacks,
  createMistakeReports,
  createSync,
  type Clock,
  type Edition,
  type GoogleVerifier,
  type Mailer,
  type Random,
} from '@slovo/server-core';
import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import { createAuthenticator } from './account/authenticator';
import { createApiHandler, INTERNAL_FAILURE, onUnexpectedFailure } from './api';
import {
  APP_SITE_ASSOCIATION_PATH,
  appSiteAssociation,
} from './collection-links/app-site-association';
import { createCollectionLinkStore } from './collection-links/collection-link-store';
import { createContentPackStore } from './content/content-pack-store';
import { createCounterStore } from './counters/counter-store';
import type { Database } from './database/database';
import { migrationState, type MigrationState } from './database/migrate';
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
  /** Where the ids of new Collection Links come from. */
  readonly random: Random;
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
  /**
   * SLOVO's Apple Developer Team ID, which the apple-app-site-association
   * file names the apps by; with none the backend serves no such file.
   */
  readonly appleTeamId: string | undefined;
  /**
   * How many proxies in front of the backend append to `X-Forwarded-For`,
   * whose addresses it trusts: 0 when nothing is in front of it.
   */
  readonly trustedProxyHops: number;
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
 * The IP address the request came from (ADR 0030). With no trusted proxy
 * hop, the address of its connection. Behind trusted proxies, each appends
 * the address it was reached from to `X-Forwarded-For`, so the client is the
 * address as many places from the end as there are hops; whatever stands
 * before it, the client wrote itself. Without that many addresses the
 * request did not come through the proxies, so its connection counts. Node
 * gives every request its connection; a request made in process without one
 * has none.
 */
function clientIp(
  bindings: Partial<HttpBindings> | undefined,
  forwardedFor: string | undefined,
  trustedProxyHops: number,
): string | undefined {
  const connection = bindings?.incoming?.socket.remoteAddress;
  if (trustedProxyHops === 0 || forwardedFor === undefined) return connection;
  const forwarded = forwardedFor
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address !== '');
  return forwarded.at(-trustedProxyHops) ?? connection;
}

/**
 * The composition root: builds the whole backend from the dependencies it is
 * given. `main.ts` gives the real ones; a test gives its own.
 */
export function createApp({
  database,
  clock,
  random,
  logger,
  editions,
  mailer,
  google,
  authSecret,
  reporter,
  appleTeamId,
  trustedProxyHops,
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
    rateLimits,
    clock,
  });
  const collectionLinks = createCollectionLinks({
    editions: editionRegistry,
    store: createCollectionLinkStore(database),
    rateLimits,
    clock,
    random,
  });
  const api = createApiHandler({
    accounts,
    collectionLinks,
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

  // Every request has the IP address of its client, which the limits per IP
  // count (ADR 0030); one without is a broken invariant.
  app.use(async (c, next) => {
    const ip = clientIp(c.env, c.req.header('x-forwarded-for'), trustedProxyHops);
    if (ip === undefined) throw new Error('the request came on no connection');
    c.set('ip', ip);
    await next();
  });

  // For a host to tell a sick server: 503 while the database doesn't answer
  // or hasn't run every migration. It names the last migration run, nothing else.
  app.get('/health', async (c) => {
    let state: MigrationState;
    try {
      await database.ping();
      state = await migrationState(database);
    } catch (error) {
      c.var.logger.warn({ err: error }, 'the database does not answer');
      return c.json({ status: 'unavailable' }, 503);
    }
    if (state.status === 'pending') {
      return c.json({ status: 'migrations pending', migration: state.last }, 503);
    }
    return c.json({ status: 'ok', migration: state.last });
  });

  // The file that lets the apps open their Collection Links (ADR 0058).
  // Without a Team ID there is none, so the path is not found.
  if (appleTeamId !== undefined) {
    const file = appSiteAssociation(appleTeamId, editions);
    app.get(APP_SITE_ASSOCIATION_PATH, (c) => c.json(file));
  }

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
