// The backend's entry point (`pnpm dev`, `pnpm start`).
import { systemClock } from '@slovo/server-core';

import { createGoogleVerifier } from './account/google-verifier';
import { createSmtpMailer } from './account/smtp-mailer';
import { createApp } from './app';
import { readConfig, ServerConfigSchema } from './config';
import { createDatabase } from './database/database';
import { readEditions } from './edition/edition-folders';
import { createLogger } from './logger';
import { systemRandom } from './random';
import { createSentryReporter } from './sentry-reporter';
import { startServer } from './server';

const config = readConfig(ServerConfigSchema, process.env);
const logger = createLogger();
const database = createDatabase(config.DATABASE_URL, logger);
const editions = readEditions(config.EDITIONS_DIR);
const mailer = createSmtpMailer(config.smtp);
const app = createApp({
  database,
  clock: systemClock,
  random: systemRandom,
  logger,
  editions,
  mailer,
  google: createGoogleVerifier({ clientIds: config.GOOGLE_CLIENT_IDS, clock: systemClock }),
  authSecret: config.AUTH_SECRET,
  reporter: await createSentryReporter(config.SENTRY_DSN),
  appleTeamId: config.APPLE_TEAM_ID,
});
const server = await startServer({ app, database, port: config.PORT });

// A host stops the server with SIGTERM before it replaces it; Ctrl-C sends SIGINT.
// The handlers come before the line that says the server listens: until a
// process has one, a signal ends it at once, without stopping the server.
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
logger.info({ port: server.port }, 'listening');
