import {
  createAccounts,
  createContentPacks,
  createEditionRegistry,
  type Clock,
  type Edition,
  type Mailer,
} from '@slovo/server-core';
import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import { createAuthenticator } from './account/authenticator';
import { createRateLimits } from './account/rate-limits';
import { createApiHandler, INTERNAL_FAILURE, logUnexpectedFailure } from './api';
import { createContentPackStore } from './content/content-pack-store';
import type { Database } from './database/database';
import { createRemoteSwitchStore } from './edition/remote-switch-store';

/** What the backend is built from. A test gives its own. */
export interface AppDependencies {
  readonly database: Database;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Every Edition the backend serves, read from the Edition folders at start. */
  readonly editions: readonly Edition[];
  /** Sends the sign-in emails. */
  readonly mailer: Mailer;
  /** Signs the Sessions' tokens. */
  readonly authSecret: string;
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
  authSecret,
}: AppDependencies) {
  const editionRegistry = createEditionRegistry({
    editions,
    remoteSwitches: createRemoteSwitchStore(database),
    clock,
  });
  const accounts = createAccounts({
    editions: editionRegistry,
    authenticator: createAuthenticator(database, { secret: authSecret, logger }),
    mailer,
    rateLimits: createRateLimits(database),
    clock,
  });
  const contentPacks = createContentPacks({
    editions: editionRegistry,
    store: createContentPackStore(database),
    clock,
  });
  const api = createApiHandler({ accounts, contentPacks, editions: editionRegistry });

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

  // The API contract at `/v1`, its description at `/docs`.
  for (const path of ['/v1/*', '/docs', '/docs/*']) {
    app.use(path, async (c, next) => {
      const { matched, response } = await api.handle(c.req.raw, {
        context: { logger: c.var.logger, headers: c.req.raw.headers, ip: c.var.ip },
      });
      if (matched) return c.newResponse(response.body, response);
      return next();
    });
  }

  // An address the backend doesn't serve, under `/v1` too.
  app.notFound((c) => c.json({ code: 'NOT_FOUND' }, 404));

  // The one global handler of what the API's own handler doesn't catch.
  app.onError((error, c) => {
    logUnexpectedFailure(c.var.logger, error);
    return c.json(INTERNAL_FAILURE, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
