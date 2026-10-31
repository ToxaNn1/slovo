import { CollectionLinkIdSchema, type AppConfig } from '@slovo/contracts';
import {
  createAccounts,
  createCollectionLinks,
  createCommunityCounters,
  createContentPacks,
  createMistakeReports,
  createSync,
  type AppleVerifier,
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
import { collectionPage, unavailablePage } from './collection-links/collection-page';
import { createContentPackStore } from './content/content-pack-store';
import { createPackEntries } from './content/pack-entries';
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
  /** The identity of the one app (ADR 0065), read from the AppConfig at start. */
  readonly app: AppConfig;
  /** Every Edition the backend serves, read from the Edition folders at start. */
  readonly editions: readonly Edition[];
  /** Sends the sign-in emails. */
  readonly mailer: Mailer;
  /** Verifies the Google identity tokens of Google sign-ins. */
  readonly google: GoogleVerifier;
  /** Verifies the Apple identity tokens of Apple sign-ins, for the app's bundle id. */
  readonly apple: AppleVerifier;
  /** Signs the Sessions' tokens. */
  readonly authSecret: string;
  /** Where the unexpected failures (500) are reported. */
  readonly reporter: ErrorReporter;
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
  app: appConfig,
  editions,
  mailer,
  google,
  apple,
  authSecret,
  reporter,
  trustedProxyHops,
}: AppDependencies) {
  const editionRegistry = createEditions({ database, clock, editions });
  const rateLimits = createRateLimits(database, { secret: authSecret });
  const accounts = createAccounts({
    editions: editionRegistry,
    authenticator: createAuthenticator(database, { secret: authSecret, logger }),
    google,
    apple,
    bundleId: appConfig.bundleId,
    mailer,
    rateLimits,
    clock,
  });
  const contentPackStore = createContentPackStore(database);
  const contentPacks = createContentPacks({
    editions: editionRegistry,
    store: contentPackStore,
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

  // The file that lets the app open its Collection Links (ADR 0058).
  // While the app has no Team ID there is none, so the path is not found.
  const association = appSiteAssociation(
    appConfig,
    editions.map(({ config }) => config.id),
  );
  if (association !== undefined) {
    app.get(APP_SITE_ASSOCIATION_PATH, (c) => c.json(association));
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

  /** The API's answer to the request, with what the backend knows of the request it came in. */
  const handleApi = (request: Request, { logger, requestId, ip }: Variables) =>
    api.handle(request, {
      context: { logger, requestId, reporter, headers: request.headers, ip },
    });

  // The API contract at `/v1`, its description at `/docs`.
  for (const path of ['/v1/*', '/docs', '/docs/*']) {
    app.use(path, async (c, next) => {
      const { matched, response } = await handleApi(c.req.raw, c.var);
      if (matched) return c.newResponse(response.body, response);
      return next();
    });
  }

  // A Collection Link as its URL names it (ADR 0058): a browser gets its web
  // page; any other client the API's answer for the link. Like the API's
  // read, it is not limited. The page of a link that isn't there speaks the
  // language of the Edition whose link domain the request came to.
  const packEntries = createPackEntries(contentPackStore);
  app.get('/c/:id', async (c) => {
    const id = c.req.param('id');
    if (!(c.req.header('accept') ?? '').includes('text/html')) {
      const url = new URL(`/v1/collection-links/${encodeURIComponent(id)}`, c.req.url);
      const { response } = await handleApi(new Request(url, c.req.raw), c.var);
      return response === undefined ? c.notFound() : c.newResponse(response.body, response);
    }
    const host = new URL(c.req.url).hostname;
    const ofDomain = editions.find(({ config }) => config.linkDomain === host) ?? editions[0];
    if (ofDomain === undefined) return c.notFound();
    if (!CollectionLinkIdSchema.safeParse(id).success) {
      return c.html(unavailablePage(ofDomain), 400);
    }
    const found = await collectionLinks.read(id);
    if (!found.ok) return c.html(unavailablePage(ofDomain), 404);
    const { link } = found;
    const edition = editions.find(({ config }) => config.id === link.edition) ?? ofDomain;
    const entries = await packEntries.entries(link.edition, link.entryIds);
    return c.html(collectionPage(edition, id, link, entries));
  });

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
