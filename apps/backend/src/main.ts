// The backend's entry point (`pnpm dev`, `pnpm start`).
import { systemClock } from '@slovo/server-core';

import { createApp } from './app';
import { readConfig, ServerConfigSchema } from './config';
import { createDatabase } from './database/database';
import { createLogger } from './logger';
import { startServer } from './server';

const config = readConfig(ServerConfigSchema, process.env);
const logger = createLogger();
const database = createDatabase(config.DATABASE_URL, logger);
const app = createApp({ database, clock: systemClock, logger });
const server = await startServer({ app, database, port: config.PORT });
logger.info({ port: server.port }, 'listening');

// A host stops the server with SIGTERM before it replaces it; Ctrl-C sends SIGINT.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'stopping');
    server.stop().then(
      () => {
        logger.info('stopped');
      },
      (error: unknown) => {
        logger.error({ err: error }, 'the server did not stop cleanly');
        process.exitCode = 1;
      },
    );
  });
}
