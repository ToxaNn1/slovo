import type { Clock } from '@slovo/server-core';
import { Hono } from 'hono';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import type { Database } from './database/database';

/** What the backend is built from. A test gives its own. */
export interface AppDependencies {
  readonly database: Database;
  readonly clock: Clock;
  readonly logger: Logger;
}

type Variables = RequestIdVariables & { logger: Logger };

/**
 * The composition root: builds the whole backend from its dependencies. It is
 * the only place that knows which adapter fills which port.
 */
export function createApp({ database, clock, logger }: AppDependencies) {
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

  return app;
}

export type App = ReturnType<typeof createApp>;
