// The backend's entry point (`pnpm dev`, `pnpm start`).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { openAppConfig, REPO_DIR } from '@slovo/language-pack/edition';
import { systemClock } from '@slovo/server-core';

import { createAppleRevoker, importAppleKey } from './account/apple-revoker';
import { createAppleVerifier } from './account/apple-verifier';
import { createGoogleVerifier } from './account/google-verifier';
import { createMailer } from './account/mailer';
import { ownerAlertsOf } from './alerts/owner-chat';
import { createApp } from './app';
import { readConfig, ServerConfigSchema } from './config';
import { createDatabase } from './database/database';
import { deploymentPorts } from './deployment-ports';
import { createEasSource } from './development/eas-source';
import { createGitHubSource } from './development/github-source';
import { readEditions } from './edition/edition-folders';
import { createLogger } from './logger';
import { systemRandom } from './random';
import { sentryOf } from './quality/sentry-api';
import { createSentryReporter } from './sentry-reporter';
import { createNbuClient } from './services/nbu-client';
import { startServer } from './server';
import { usagePortsOf } from './services/usage-ports';
import { createVault, VAULT_OFF } from './services/vault';

const config = readConfig(ServerConfigSchema, process.env);
const logger = createLogger();
const database = createDatabase(config.DATABASE_URL, logger);
const editions = readEditions(config.EDITIONS_DIR);
const appConfig = openAppConfig(REPO_DIR).config;
const ports = deploymentPorts(config, { clock: systemClock });
const mailer = createMailer(config.mail);
// The owner admin app as `pnpm --filter @slovo/admin build` leaves it; `pnpm dev:admin` serves it in Vite.
const adminDist = join(REPO_DIR, 'apps/admin/dist');
// Without the Sign in with Apple key a deleted Account stays authorised at Apple.
if (config.appleKey === undefined) {
  logger.warn(
    'APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY are unset: Sign in with Apple is not revoked when an Account is deleted',
  );
}
const appleRevoker = createAppleRevoker({
  key: config.appleKey && (await importAppleKey(config.appleKey)),
  clock: systemClock,
});
const app = createApp({
  database,
  clock: systemClock,
  random: systemRandom,
  logger,
  app: appConfig,
  editions,
  mailer,
  alerts: ownerAlertsOf(database, config, logger),
  posthog: ports.posthog,
  nbu: createNbuClient(),
  google: createGoogleVerifier({ clientIds: config.GOOGLE_CLIENT_IDS, clock: systemClock }),
  apple: createAppleVerifier({ clock: systemClock }),
  appleRevoker,
  github: createGitHubSource({
    token: config.GITHUB_TOKEN,
    repository: config.GITHUB_REPOSITORY,
    logger,
  }),
  eas: createEasSource({ token: config.EXPO_TOKEN, projectId: config.EAS_PROJECT_ID, logger }),
  authSecret: config.AUTH_SECRET,
  reporter: await createSentryReporter(config.SENTRY_DSN, ports.sentryEnvironment),
  trustedProxyHops: config.TRUSTED_PROXY_HOPS,
  edgeSecret: config.EDGE_SECRET,
  adminDist: existsSync(join(adminDist, 'index.html')) ? adminDist : undefined,
  sentry: sentryOf(config, systemClock),
  // «Сервіси» reads usage with the keys Якість and the Аналітика already hold.
  usage: usagePortsOf(
    { ...config, R2_ACCOUNT_ID: config.r2?.accountId, R2_BUCKET: config.r2?.bucket },
    { clock: systemClock, logger },
  ),
  ciToken: config.CI_HISTORY_TOKEN,
  mediaBase: config.mediaBase,
  mediaStore: ports.mediaStore,
  // Without VAULT_KEY the Vault is off: no Service entry is written.
  vault: config.VAULT_KEY === undefined ? VAULT_OFF : createVault(config.VAULT_KEY),
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
