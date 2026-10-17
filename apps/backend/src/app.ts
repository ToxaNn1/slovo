import {
  createContentPacks,
  createEditionRegistry,
  type Clock,
  type Edition,
} from '@slovo/server-core';
import { Hono } from 'hono';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import { createApiHandler, INTERNAL_FAILURE, logUnexpectedFailure } from './api';
import { createContentPackStore } from './content/content-pack-store';
import type { Database } from './database/database';

/** What the backend is built from. A test gives its own. */
export interface AppDependencies {
  readonly database: Database;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Every Edition the backend serves, read from the Edition folders at start. */
  readonly editions: readonly Edition[];
}

type Variables = RequestIdVariables & { logger: Logger };

/**
 * The composition root: builds the whole backend from the dependencies it is
 * given. `main.ts` gives the real ones; a test gives its own.
 */
export function createApp({ database, clock, logger, editions }: AppDependencies) {
  const contentPacks = createContentPacks({
    editions: createEditionRegistry(editions),
    store: createContentPackStore(database),
  });
  const api = createApiHandler({ contentPacks });

  const app = new Hono<{ Variables: Variables }>();

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
        context: { logger: c.var.logger },
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
