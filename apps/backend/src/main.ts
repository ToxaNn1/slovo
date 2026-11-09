// The backend's entry point (`pnpm dev`, `pnpm start`).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { openAppConfig, REPO_DIR } from '@slovo/language-pack/edition';
import { systemClock } from '@slovo/server-core';

import { createAppleVerifier } from './account/apple-verifier';
import { createGoogleVerifier } from './account/google-verifier';
import { createSmtpMailer } from './account/smtp-mailer';
import { ownerAlertsOf } from './alerts/owner-chat';
import { createApp } from './app';
import { readConfig, ServerConfigSchema } from './config';
import { createDatabase } from './database/database';
import { createEasSource } from './development/eas-source';
import { createGitHubSource } from './development/github-source';
import { readEditions } from './edition/edition-folders';
import { createLogger } from './logger';
import { systemRandom } from './random';
import { sentryOf } from './quality/sentry-api';
import { createSentryReporter } from './sentry-reporter';
import { createPostHogClient, unavailablePostHog } from './analytics/posthog-client';
import { startServer } from './server';

const config = readConfig(ServerConfigSchema, process.env);
const logger = createLogger();
const database = createDatabase(config.DATABASE_URL, logger);
const editions = readEditions(config.EDITIONS_DIR);
const appConfig = openAppConfig(REPO_DIR).config;
const mailer = createSmtpMailer(config.smtp);
// The owner admin app as `pnpm --filter @slovo/admin build` leaves it; `pnpm dev:admin` serves it in Vite.
const adminDist = join(REPO_DIR, 'apps/admin/dist');
const app = createApp({
  database,
  clock: systemClock,
  random: systemRandom,
  logger,
  app: appConfig,
  editions,
  mailer,
  alerts: ownerAlertsOf(database, logger),
  posthog: config.posthog === undefined ? unavailablePostHog : createPostHogClient(config.posthog),
  google: createGoogleVerifier({ clientIds: config.GOOGLE_CLIENT_IDS, clock: systemClock }),
  apple: createAppleVerifier({ clock: systemClock }),
  github: createGitHubSource({
    token: config.GITHUB_TOKEN,
    repository: config.GITHUB_REPOSITORY,
    logger,
  }),
  eas: createEasSource({ token: config.EXPO_TOKEN, projectId: config.EAS_PROJECT_ID, logger }),
  authSecret: config.AUTH_SECRET,
  reporter: await createSentryReporter(config.SENTRY_DSN),
  trustedProxyHops: config.TRUSTED_PROXY_HOPS,
  adminDist: existsSync(join(adminDist, 'index.html')) ? adminDist : undefined,
  sentry: sentryOf(config, systemClock),
  ciToken: config.CI_HISTORY_TOKEN,
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
