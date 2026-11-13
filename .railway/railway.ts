// The Deployment's Railway project as Infrastructure as Code (ADR 0103):
// the backend and its three Cron services, all in EU West (Amsterdam), one
// replica each. No service has a source: CI deploys with `railway up`. The
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

export default defineRailway(() => {
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
      R2_ACCOUNT_ID: preserve(),
      R2_BUCKET: preserve(),
      R2_ACCESS_KEY_ID: preserve(),
      R2_SECRET_ACCESS_KEY: preserve(),
      MEDIA_BASE: preserve(),
      TRUSTED_PROXY_HOPS: preserve(),
    },
  });

  const alerts = service('alerts', {
    build: dockerfile('Dockerfile'),
    deploy: cron('pnpm cron', '*/15 * * * *'),
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
    },
  });

  return project('slovo', { resources: [backend, alerts, quoteCheck, recordings] });
});
