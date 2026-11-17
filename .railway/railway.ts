// The Deployment's Railway project as Infrastructure as Code (ADR 0103):
// the backend and its three Cron services, all in EU West (Amsterdam), one
// replica each. The `staging` environment is the Staging Deployment (ADR
// 0168): the backend alone, asleep when idle, with no Cron service. No service has a source: CI deploys with `railway up`. The
// repository holds no secret, so every secret and every value that belongs to
// SLOVO's accounts is `preserve()`: Railway keeps the value set there.
// docs/deploy.md lists what each variable holds.
import { defineRailway, preserve, project, service } from 'railway/iac';

const EU_WEST_AMSTERDAM = { 'europe-west4-drams3a': 1 };

function dockerfile(path: string) {
  return { builder: 'DOCKERFILE', dockerfilePath: path } as const;
}

function cron(startCommand: string, cronSchedule: string) {
  return { startCommand, cronSchedule, restartPolicyType: 'NEVER' } as const;
}

/** The Staging Deployment's address on the app's domain, proxied by Cloudflare. */
const STAGING_DOMAIN = 'staging.slovoapp.org';

/** The port the Staging Deployment's backend listens on, behind its domain. */
const STAGING_PORT = 8080;

export default defineRailway((ctx) => {
  if (ctx.isEnvironment('staging')) return stagingProject();

  const backend = service('backend', {
    build: dockerfile('Dockerfile'),
    preDeploy: 'pnpm db:migrate',
    healthcheck: '/health',
    healthcheckTimeout: 120,
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 5 },
    replicas: EU_WEST_AMSTERDAM,
    env: {
      DATABASE_URL: preserve(),
      AUTH_SECRET: preserve(),
      VAULT_KEY: preserve(),
      ZEPTOMAIL_API_URL: preserve(),
      ZEPTOMAIL_TOKEN: preserve(),
      MAIL_FROM: preserve(),
      GOOGLE_CLIENT_IDS: preserve(),
      SENTRY_DSN: preserve(),
      SENTRY_AUTH_TOKEN: preserve(),
      SENTRY_ORG: preserve(),
      SENTRY_APP_PROJECT: preserve(),
      SENTRY_BACKEND_PROJECT: preserve(),
      CI_HISTORY_TOKEN: preserve(),
      TELEGRAM_BOT_TOKEN: preserve(),
      TELEGRAM_CHAT_ID: preserve(),
      GITHUB_TOKEN: preserve(),
      EXPO_TOKEN: preserve(),
      POSTHOG_PERSONAL_API_KEY: preserve(),
      POSTHOG_PROJECT_ID: preserve(),
      POSTHOG_HOST: preserve(),
      R2_ACCOUNT_ID: preserve(),
      R2_BUCKET: preserve(),
      R2_ACCESS_KEY_ID: preserve(),
      R2_SECRET_ACCESS_KEY: preserve(),
      MEDIA_BASE: preserve(),
      TRUSTED_PROXY_HOPS: preserve(),
      RAILWAY_READ_TOKEN: preserve(),
      NEON_API_KEY: preserve(),
      NEON_PROJECT_ID: preserve(),
      CLOUDFLARE_API_TOKEN: preserve(),
    },
  });

  const alerts = service('alerts', {
    build: dockerfile('Dockerfile'),
    deploy: cron('pnpm cron', '0 * * * *'),
    replicas: EU_WEST_AMSTERDAM,
    env: {
      DATABASE_URL: backend.env.DATABASE_URL,
      TELEGRAM_BOT_TOKEN: backend.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: backend.env.TELEGRAM_CHAT_ID,
      SENTRY_AUTH_TOKEN: backend.env.SENTRY_AUTH_TOKEN,
      SENTRY_ORG: backend.env.SENTRY_ORG,
      SENTRY_APP_PROJECT: backend.env.SENTRY_APP_PROJECT,
      SENTRY_BACKEND_PROJECT: backend.env.SENTRY_BACKEND_PROJECT,
      POSTHOG_PERSONAL_API_KEY: backend.env.POSTHOG_PERSONAL_API_KEY,
      POSTHOG_PROJECT_ID: backend.env.POSTHOG_PROJECT_ID,
      BACKEND_HEALTH_URL: preserve(),
      // The usage ports' keys for the 90 % Alert (ADR 0164); Railway sets the project and environment.
      RAILWAY_READ_TOKEN: backend.env.RAILWAY_READ_TOKEN,
      NEON_API_KEY: backend.env.NEON_API_KEY,
      NEON_PROJECT_ID: backend.env.NEON_PROJECT_ID,
      GITHUB_TOKEN: backend.env.GITHUB_TOKEN,
      CLOUDFLARE_API_TOKEN: backend.env.CLOUDFLARE_API_TOKEN,
      R2_ACCOUNT_ID: backend.env.R2_ACCOUNT_ID,
      R2_BUCKET: backend.env.R2_BUCKET,
    },
  });

  const quoteCheck = service('quote-check', {
    build: dockerfile('Dockerfile'),
    deploy: cron('pnpm quote-check', '0 * * * *'),
    replicas: EU_WEST_AMSTERDAM,
    env: { DATABASE_URL: backend.env.DATABASE_URL },
  });

  const recordings = service('recordings', {
    build: dockerfile('recordings.Dockerfile'),
    deploy: cron('pnpm recordings', '0 * * * *'),
    replicas: EU_WEST_AMSTERDAM,
    env: {
      DATABASE_URL: backend.env.DATABASE_URL,
      R2_ACCOUNT_ID: backend.env.R2_ACCOUNT_ID,
      R2_BUCKET: backend.env.R2_BUCKET,
      R2_ACCESS_KEY_ID: backend.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: backend.env.R2_SECRET_ACCESS_KEY,
      TELEGRAM_BOT_TOKEN: backend.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: backend.env.TELEGRAM_CHAT_ID,
    },
  });

  return project('slovo', { resources: [backend, alerts, quoteCheck, recordings] });
});

/**
 * The Staging Deployment (ADR 0168): the backend alone, with variables of its
 * own. It sleeps while no request comes, and no Cron service or scheduled
 * check runs, so its Neon branch scales to zero. `DEPLOYMENT=staging` keeps
 * Analytics, Media Store writes and production's Sentry environment out.
 * Railway's health check runs only while a deploy rolls out.
 */
function stagingProject() {
  const backend = service('backend', {
    build: dockerfile('Dockerfile'),
    preDeploy: 'pnpm db:migrate',
    healthcheck: '/health',
    healthcheckTimeout: 120,
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 5, sleepApplication: true },
    replicas: EU_WEST_AMSTERDAM,
    domains: [{ domain: STAGING_DOMAIN, port: STAGING_PORT }],
    env: {
      DEPLOYMENT: 'staging',
      PORT: String(STAGING_PORT),
      DATABASE_URL: preserve(),
      AUTH_SECRET: preserve(),
      ZEPTOMAIL_API_URL: preserve(),
      ZEPTOMAIL_TOKEN: preserve(),
      MAIL_FROM: preserve(),
      GOOGLE_CLIENT_IDS: preserve(),
      SENTRY_DSN: preserve(),
      // Production's Media Store root: staging reads its public URLs, no R2 key.
      MEDIA_BASE: preserve(),
      TRUSTED_PROXY_HOPS: preserve(),
    },
  });

  return project('slovo', { resources: [backend] });
}
